import { BROWSER_UA, CRAWLERS, type CrawlerKind } from "./crawlers";
import {
  extractSignals,
  extractView,
  headerDirectives,
  looksLikeChallenge,
  type PageView,
  type RobotsDirective,
} from "./html";
import { isAllowed, parseRobots, type RobotsVerdict } from "./robots";
import { FetchError, safeFetch, type FetchResult } from "./safe-fetch";

/**
 * AI visibility analysis for a single URL.
 *
 * Everything here runs from one server, which is not where the real crawlers
 * run. Two consequences are surfaced in the report rather than hidden:
 *
 *  - A firewall that verifies crawler IPs will reject our spoofed GPTBot while
 *    letting the real one through, so a live-test block is a strong hint, not
 *    proof.
 *  - A site that challenges all data-centre traffic challenges us too. That is
 *    itself a finding, since every AI crawler also runs from a data centre.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type Check = {
  id: string;
  group: "access" | "content" | "signals";
  status: CheckStatus;
  title: string;
  detail: string;
};

export type LiveResult = {
  status: number | null;
  outcome: "ok" | "blocked" | "reduced" | "error";
  note: string;
};

export type CrawlerReport = {
  token: string;
  vendor: string;
  kind: CrawlerKind;
  purpose: string;
  tokenOnly: boolean;
  robots: RobotsVerdict;
  live: LiveResult | null;
};

export type Report = {
  url: string;
  finalUrl: string;
  checkedAt: string;
  score: number;
  summary: string;
  page: {
    status: number;
    ms: number;
    contentType: string;
    redirects: string[];
    title: string | null;
    description: string | null;
    canonical: string | null;
    lang: string | null;
    h1: string[];
    words: number;
    jsonLdTypes: string[];
  };
  /** The page as a crawler that skips JavaScript receives it. */
  view: PageView;
  /**
   * Views for live-tested crawlers that were served something different from
   * the browser, keyed by token. A crawler absent here got the same page.
   */
  crawlerViews: Record<string, PageView>;
  robots: { url: string; state: "found" | "missing" | "unreachable" | "html"; httpStatus: number | null; sitemaps: string[] };
  crawlers: CrawlerReport[];
  directives: RobotsDirective[];
  checks: Check[];
};

export class InputError extends Error {}

/**
 * Accepts `example.com`, `https://example.com/page`, `HTTP://Example.com` and
 * friends, and returns a URL. The scheme is always dropped and https assumed.
 */
export function normaliseInput(raw: string): URL {
  const trimmed = raw.trim().replace(/^(https?:)?\/\//i, "");
  if (!trimmed) throw new InputError("Enter a domain or URL to check");
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^[^/]+:\d+(\/|$)/.test(trimmed)) {
    throw new InputError("Only web addresses can be checked");
  }

  let url: URL;
  try {
    url = new URL(`https://${trimmed}`);
  } catch {
    throw new InputError("That doesn't look like a valid address");
  }

  const host = url.hostname;
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) {
    throw new InputError("Enter a domain name, such as example.com");
  }
  if (!/\.[a-z][a-z0-9-]*$/i.test(host) && !/\.xn--[a-z0-9-]+$/i.test(host)) {
    throw new InputError("That domain has no valid top-level domain");
  }
  url.hash = "";
  return url;
}

function friendlyError(err: unknown): string {
  if (err instanceof FetchError) return err.message;
  return "The request failed";
}

async function fetchPage(url: URL): Promise<{ res: FetchResult; downgraded: boolean }> {
  try {
    return { res: await safeFetch(url, { userAgent: BROWSER_UA }), downgraded: false };
  } catch (err) {
    // Plain-http sites still exist. Timeouts and blocked addresses are not
    // retried: a second attempt would fail the same way.
    if (!(err instanceof FetchError) || err.code !== "network") throw err;
    const insecure = new URL(url);
    insecure.protocol = "http:";
    try {
      return { res: await safeFetch(insecure, { userAgent: BROWSER_UA }), downgraded: true };
    } catch {
      throw err;
    }
  }
}

async function tryFetch(url: string, userAgent = BROWSER_UA, timeoutMs = 8_000) {
  try {
    return await safeFetch(url, { userAgent, timeoutMs });
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

const isHtmlBody = (body: string) => /^\s*(<!doctype html|<html|<head|<body)/i.test(body);

function liveOutcome(bot: FetchResult | Error, page: FetchResult, pageWords: number): LiveResult {
  if (bot instanceof Error) {
    // A slow answer might be tarpitting, or just a slow moment. Only a
    // refused or dropped connection is treated as a deliberate block.
    if (bot instanceof FetchError && bot.code === "timeout") {
      return { status: null, outcome: "error", note: "No response in time, so this test is inconclusive" };
    }
    return { status: null, outcome: "blocked", note: `${friendlyError(bot)} for this user agent only` };
  }
  if (bot.status >= 400 && page.status < 400) {
    return { status: bot.status, outcome: "blocked", note: `Rejected with HTTP ${bot.status}` };
  }
  if (looksLikeChallenge(bot.body) && !looksLikeChallenge(page.body)) {
    return { status: bot.status, outcome: "blocked", note: "Served a bot challenge page" };
  }
  const words = extractSignals(bot.body).words;
  if (pageWords >= 100 && words < pageWords * 0.4) {
    return {
      status: bot.status,
      outcome: "reduced",
      note: `Served ${words} words, against ${pageWords} for a browser`,
    };
  }
  return { status: bot.status, outcome: "ok", note: `Served the page (${words} words)` };
}

const AI_TOKENS = new Set(CRAWLERS.map((c) => c.token.toLowerCase()));
const SEARCH_SCOPES = new Set(["robots", "googlebot", "bingbot"]);

export async function analyse(input: URL): Promise<Report> {
  const { res: page, downgraded } = await fetchPage(input);
  const finalUrl = new URL(page.url);
  const origin = finalUrl.origin;
  const robotsPath = finalUrl.pathname + finalUrl.search;
  const contentType = page.headers["content-type"] ?? "";
  const pageIsHtml = /html|xml/i.test(contentType) || isHtmlBody(page.body);
  const pageChallenged = looksLikeChallenge(page.body) || page.status === 403 || page.status === 429;
  const signals = extractSignals(pageIsHtml ? page.body : "");

  const liveCrawlers = CRAWLERS.filter((c) => c.userAgent);
  // The sitemap fallback depends on robots.txt, so it is chained onto it
  // rather than awaited afterwards, keeping the whole check inside one window.
  // robots.txt gets one retry: "unreachable" means "disallow everything", far
  // too strong a verdict to hang on a single dropped request.
  const fetchRobots = async () => {
    const first = await tryFetch(`${origin}/robots.txt`);
    const failed = first instanceof Error || first.status >= 500;
    return failed ? tryFetch(`${origin}/robots.txt`) : first;
  };
  const robotsWithSitemap = fetchRobots().then(async (res) => {
    const listed = !(res instanceof Error) && res.status < 400 && parseRobots(res.body).sitemaps.length > 0;
    return { res, sitemap: listed ? null : await tryFetch(`${origin}/sitemap.xml`, BROWSER_UA, 6_000) };
  });
  const [{ res: robotsRes, sitemap: sitemapRes }, llmsRes, liveResults] = await Promise.all([
    robotsWithSitemap,
    tryFetch(`${origin}/llms.txt`),
    Promise.all(liveCrawlers.map((c) => tryFetch(page.url, c.userAgent))),
  ]);

  // --- robots.txt -----------------------------------------------------------
  let robotsState: Report["robots"]["state"];
  let robotsText = "";
  if (robotsRes instanceof Error || robotsRes.status >= 500) robotsState = "unreachable";
  else if (robotsRes.status >= 400) robotsState = "missing";
  else if (isHtmlBody(robotsRes.body)) robotsState = "html";
  else {
    robotsState = "found";
    robotsText = robotsRes.body;
  }
  const robots = parseRobots(robotsText);

  const sitemapFound =
    robots.sitemaps.length > 0 ||
    (sitemapRes !== null &&
      !(sitemapRes instanceof Error) &&
      sitemapRes.status === 200 &&
      /<(urlset|sitemapindex)\b/i.test(sitemapRes.body));

  // --- directives ------------------------------------------------------------
  const directives = [...signals.directives, ...headerDirectives(page.headers["x-robots-tag"])];

  // --- per-crawler ------------------------------------------------------------
  const crawlers: CrawlerReport[] = CRAWLERS.map((c) => {
    // RFC 9309 §2.3.1.4: an unreachable robots.txt means crawlers should
    // assume everything is disallowed.
    const verdict: RobotsVerdict =
      robotsState === "unreachable"
        ? { allowed: false, group: null, rule: "robots.txt unreachable" }
        : isAllowed(robots, c.token, robotsPath);
    const liveIndex = liveCrawlers.indexOf(c);
    return {
      token: c.token,
      vendor: c.vendor,
      kind: c.kind,
      purpose: c.purpose,
      tokenOnly: Boolean(c.tokenOnly),
      robots: verdict,
      live: liveIndex === -1 || pageChallenged ? null : liveOutcome(liveResults[liveIndex], page, signals.words),
    };
  });

  // --- checks and score -----------------------------------------------------
  const checks: Check[] = [];
  let score = 0;

  // Access: robots.txt (30)
  const answerBots = crawlers.filter((c) => c.kind !== "training");
  const trainingBots = crawlers.filter((c) => c.kind === "training");
  const blockedAnswer = answerBots.filter((c) => !c.robots.allowed);
  const blockedTraining = trainingBots.filter((c) => !c.robots.allowed);
  score += 24 * (1 - blockedAnswer.length / answerBots.length);
  score += 6 * (1 - blockedTraining.length / trainingBots.length);

  if (robotsState === "unreachable") {
    checks.push({
      id: "robots",
      group: "access",
      status: "fail",
      title: "robots.txt could not be fetched",
      detail:
        "The server errored or timed out on /robots.txt. Under the robots.txt standard, crawlers treat that as “disallow everything” until it recovers.",
    });
  } else if (robotsState === "html") {
    checks.push({
      id: "robots",
      group: "access",
      status: "warn",
      title: "robots.txt returns an HTML page",
      detail:
        "/robots.txt answers with a web page, usually a catch-all route in a single-page app. Crawlers find no rules in it and assume everything is allowed, but any rules you meant to publish are not being served.",
    });
  } else if (robotsState === "missing") {
    checks.push({
      id: "robots",
      group: "access",
      status: "pass",
      title: "No robots.txt, so nothing is blocked",
      detail:
        "Without a robots.txt, every crawler may fetch every page. Adding one is still worth it, to list your sitemap.",
    });
  }

  if (robotsState !== "unreachable") {
    if (blockedAnswer.length > 0) {
      checks.push({
        id: "robots-answer",
        group: "access",
        status: "fail",
        title: `robots.txt blocks ${blockedAnswer.length} AI search or assistant crawler${blockedAnswer.length === 1 ? "" : "s"}`,
        detail: `${blockedAnswer.map((c) => c.token).join(", ")} ${blockedAnswer.length === 1 ? "is" : "are"} disallowed from this page. These are the crawlers that fetch pages to cite in AI answers, so blocking them keeps this page out of those answers.`,
      });
    } else {
      checks.push({
        id: "robots-answer",
        group: "access",
        status: "pass",
        title: "AI search and assistant crawlers are allowed",
        detail: "Every crawler that fetches pages to cite in AI answers may read this page.",
      });
    }

    checks.push(
      blockedTraining.length > 0
        ? {
            id: "robots-training",
            group: "access",
            status: "info",
            title: `${blockedTraining.length} AI training crawler${blockedTraining.length === 1 ? " is" : "s are"} blocked`,
            detail: `${blockedTraining.map((c) => c.token).join(", ")}. Opting out of model training is a legitimate choice and does not by itself keep you out of AI search answers.`,
          }
        : {
            id: "robots-training",
            group: "access",
            status: "pass",
            title: "AI training crawlers are allowed",
            detail: "Your content can be used to train models, which helps them know your brand without a live lookup.",
          },
    );
  }

  // Access: firewall (20)
  const tested = crawlers.filter((c) => c.live);
  if (pageChallenged) {
    checks.push({
      id: "firewall",
      group: "access",
      status: "fail",
      title: "The site challenges automated traffic",
      detail:
        "Even a normal browser request from our server got a bot challenge or was refused. AI crawlers also run from data centres, so they are very likely hitting the same wall. Check your CDN or firewall's bot settings.",
    });
  } else {
    const blockedLive = tested.filter((c) => c.live?.outcome === "blocked");
    const reducedLive = tested.filter((c) => c.live?.outcome === "reduced");
    const answered = tested.filter((c) => c.live?.outcome !== "error");
    score +=
      answered.length === 0 ? 20 : 20 * (1 - (blockedLive.length + reducedLive.length * 0.5) / answered.length);

    if (blockedLive.length > 0) {
      checks.push({
        id: "firewall",
        group: "access",
        status: "fail",
        title: `The server rejects ${blockedLive.map((c) => c.token).join(", ")}`,
        detail:
          "Requests with these crawlers' user agents were refused while a browser request succeeded. Some firewalls verify crawler IPs and block impostors like our test while letting the real bot through, so confirm in your CDN's bot settings.",
      });
    } else if (reducedLive.length > 0) {
      checks.push({
        id: "firewall",
        group: "access",
        status: "warn",
        title: "AI crawlers are served less content",
        detail: `${reducedLive.map((c) => c.token).join(", ")} received noticeably less text than a browser did. Crawlers can only cite what they are sent.`,
      });
    } else if (answered.length === 0) {
      checks.push({
        id: "firewall",
        group: "access",
        status: "info",
        title: "Firewall test inconclusive",
        detail: "None of the requests made as AI crawlers were answered in time, so blocking could not be confirmed or ruled out. Try again in a minute.",
      });
    } else {
      checks.push({
        id: "firewall",
        group: "access",
        status: "pass",
        title: "No firewall blocking detected",
        detail: `Requests as ${answered.map((c) => c.token).join(", ")} got the same page as a browser.`,
      });
    }
  }

  if (page.status >= 400) {
    checks.push({
      id: "status",
      group: "access",
      status: "fail",
      title: `The page returns HTTP ${page.status}`,
      detail: "Crawlers do not index or cite pages that return an error status.",
    });
  }
  if (downgraded) {
    checks.push({
      id: "https",
      group: "access",
      status: "warn",
      title: "HTTPS is not working",
      detail: "The site only answered over plain http. Crawlers and browsers increasingly treat that as untrustworthy.",
    });
  }
  if (page.redirects.length > 2) {
    checks.push({
      id: "redirects",
      group: "access",
      status: "warn",
      title: `${page.redirects.length} redirects before the page loads`,
      detail: "Long redirect chains waste crawl budget, and some fetchers give up after a few hops. Link straight to the final URL.",
    });
  }
  if (page.ms > 3_000) {
    checks.push({
      id: "speed",
      group: "access",
      status: "warn",
      title: `Slow response (${(page.ms / 1000).toFixed(1)}s)`,
      detail: "User-triggered fetchers answer a person in real time and may give up on slow pages.",
    });
  }

  // Signals: indexing directives (15)
  let directiveScore = 15;
  const noindexSearch = directives.filter(
    (d) => SEARCH_SCOPES.has(d.scope) && (d.directive === "noindex" || d.directive === "none"),
  );
  const noindexAi = directives.filter(
    (d) => AI_TOKENS.has(d.scope) && !SEARCH_SCOPES.has(d.scope) && (d.directive === "noindex" || d.directive === "none"),
  );
  const nosnippet = directives.filter(
    (d) => SEARCH_SCOPES.has(d.scope) && (d.directive === "nosnippet" || d.directive.replace(/\s/g, "") === "max-snippet:0"),
  );
  const noai = directives.filter((d) => d.directive === "noai" || d.directive === "noimageai");

  if (noindexSearch.length > 0) {
    directiveScore = 0;
    checks.push({
      id: "noindex",
      group: "signals",
      status: "fail",
      title: "The page is marked noindex",
      detail: `Found “${noindexSearch.map((d) => `${d.scope}: ${d.directive}`).join("”, “")}” in the ${noindexSearch[0].source === "meta" ? "HTML" : "X-Robots-Tag header"}. Search engines drop the page, and AI answers built on their indexes (AI Overviews, Copilot) drop it with them.`,
    });
  }
  if (noindexAi.length > 0) {
    directiveScore -= 5;
    checks.push({
      id: "noindex-ai",
      group: "signals",
      status: "warn",
      title: "noindex set for specific AI crawlers",
      detail: `The page tells ${[...new Set(noindexAi.map((d) => d.scope))].join(", ")} not to index it.`,
    });
  }
  if (nosnippet.length > 0) {
    directiveScore -= 7;
    checks.push({
      id: "nosnippet",
      group: "signals",
      status: "warn",
      title: "Snippets are disabled",
      detail: "nosnippet or max-snippet:0 stops Google quoting the page, which also keeps it out of AI Overviews as a source.",
    });
  }
  if (noai.length > 0) {
    directiveScore -= 3;
    checks.push({
      id: "noai",
      group: "signals",
      status: "info",
      title: "noai directive found",
      detail: "noai and noimageai are not part of any standard and the major AI vendors do not document support for them. Use robots.txt to opt out reliably.",
    });
  }
  if (noindexSearch.length + noindexAi.length + nosnippet.length + noai.length === 0) {
    checks.push({
      id: "noindex",
      group: "signals",
      status: "pass",
      title: "No blocking meta robots or X-Robots-Tag",
      detail: "Nothing in the HTML or response headers asks crawlers to skip or hide this page.",
    });
  }
  score += Math.max(0, directiveScore);

  // Content: readable without JavaScript (25)
  const { words } = signals;
  // Low word counts alone do not prove JavaScript rendering; some pages are
  // just short. The claim is only made with evidence of an app shell.
  const jsShell =
    signals.emptyAppShell || signals.jsRequiredNotice || (words < 50 && signals.scripts >= 3);
  if (pageChallenged) {
    checks.push({
      id: "content",
      group: "content",
      status: "info",
      title: "Content could not be read",
      detail: "The page served a challenge instead of content, so there was nothing to analyse.",
    });
  } else if (!pageIsHtml) {
    checks.push({
      id: "content",
      group: "content",
      status: "warn",
      title: "The URL is not an HTML page",
      detail: `It returned ${contentType || "an unknown content type"}. Check a page URL instead.`,
    });
  } else {
    let contentScore = words >= 300 ? 25 : words >= 150 ? 18 : words >= 50 ? 10 : 0;
    if (jsShell && words < 150) contentScore = Math.min(contentScore, 5);
    score += contentScore;

    if (jsShell && words < 150) {
      checks.push({
        id: "content",
        group: "content",
        status: "fail",
        title: "The content depends on JavaScript",
        detail: `The raw HTML holds only ${words} words and looks like an app shell that fills itself in with JavaScript. Most AI crawlers read the HTML and never run scripts, so they see an almost empty page. Render the content on the server or pre-render it at build time.`,
      });
    } else if (words < 50) {
      checks.push({
        id: "content",
        group: "content",
        status: "fail",
        title: `Almost no text in the HTML (${words} words)`,
        detail: "Crawlers find next to nothing here to understand or quote. If the page shows more in a browser, JavaScript is adding it; render that text on the server instead.",
      });
    } else if (words < 150) {
      checks.push({
        id: "content",
        group: "content",
        status: "warn",
        title: `Thin content without JavaScript (${words} words)`,
        detail: "Crawlers that skip scripts find little to quote here. If more text appears in a browser, it is being added by JavaScript.",
      });
    } else {
      checks.push({
        id: "content",
        group: "content",
        status: "pass",
        title: `Readable without JavaScript (${words.toLocaleString("en-US")} words)`,
        detail: "The text is in the HTML response itself, so crawlers that never run scripts can still read it.",
      });
    }
  }

  // Signals: metadata (10)
  if (pageIsHtml && !pageChallenged) {
    score += (signals.title ? 3 : 0) + (signals.description ? 2 : 0) + (signals.h1.length ? 2 : 0) + (signals.lang ? 1 : 0) + (signals.jsonLdTypes.length ? 2 : 0);

    checks.push(
      signals.title
        ? { id: "title", group: "signals", status: "pass", title: "Has a title", detail: signals.title }
        : { id: "title", group: "signals", status: "fail", title: "Missing <title>", detail: "The title is the first thing crawlers use to understand and label a page." },
      signals.description
        ? { id: "description", group: "signals", status: "pass", title: "Has a meta description", detail: signals.description }
        : { id: "description", group: "signals", status: "warn", title: "Missing meta description", detail: "A one or two sentence summary helps crawlers and answer engines describe the page accurately." },
      signals.h1.length === 1
        ? { id: "h1", group: "signals", status: "pass", title: "One clear H1", detail: signals.h1[0] }
        : signals.h1.length === 0
          ? { id: "h1", group: "signals", status: "warn", title: "No H1 heading in the HTML", detail: "A main heading tells crawlers what the page is about. If it exists in the browser, JavaScript is adding it." }
          : { id: "h1", group: "signals", status: "info", title: `${signals.h1.length} H1 headings`, detail: "Not an error, but one main heading gives crawlers a clearer topic." },
      signals.jsonLdTypes.length
        ? { id: "schema", group: "signals", status: "pass", title: "Structured data present", detail: `JSON-LD types: ${signals.jsonLdTypes.join(", ")}.` }
        : { id: "schema", group: "signals", status: "warn", title: "No structured data", detail: "JSON-LD (schema.org) states facts about the page, such as its author, organisation or product, in a form machines read without guessing." },
    );
    if (!signals.lang) {
      checks.push({ id: "lang", group: "signals", status: "info", title: "No lang attribute on <html>", detail: "Declaring the language helps crawlers match the page to queries in that language." });
    }

    if (signals.canonical) {
      try {
        const canonical = new URL(signals.canonical, finalUrl);
        const strip = (u: URL) => `${u.host}${u.pathname.replace(/\/$/, "")}${u.search}`;
        if (strip(canonical) !== strip(finalUrl)) {
          checks.push({
            id: "canonical",
            group: "signals",
            status: "warn",
            title: "Canonical points to a different URL",
            detail: `The page declares ${canonical.href} as its canonical, so crawlers may credit that URL instead of this one.`,
          });
        }
      } catch {
        // An unparseable canonical is ignored by crawlers, and here.
      }
    }
  }

  checks.push(
    sitemapFound
      ? {
          id: "sitemap",
          group: "signals",
          status: "pass",
          title: "Sitemap found",
          detail: robots.sitemaps.length ? `Listed in robots.txt: ${robots.sitemaps[0]}` : `Found at ${origin}/sitemap.xml`,
        }
      : {
          id: "sitemap",
          group: "signals",
          status: "warn",
          title: "No sitemap found",
          detail: "Neither robots.txt nor /sitemap.xml points to one. A sitemap is how crawlers discover pages they have no link to.",
        },
  );

  const llmsFound =
    !(llmsRes instanceof Error) && llmsRes.status === 200 && llmsRes.body.trim().length > 0 && !isHtmlBody(llmsRes.body);
  checks.push({
    id: "llms",
    group: "signals",
    status: "info",
    title: llmsFound ? "llms.txt found" : "No llms.txt",
    detail: llmsFound
      ? "The site publishes /llms.txt. It is a proposed convention; no major AI crawler has documented using it, so it is not scored."
      : "/llms.txt is a proposed convention that no major AI crawler has documented using. Not scored.",
  });

  const crawlerViews: Record<string, PageView> = {};
  liveCrawlers.forEach((c, i) => {
    const res = liveResults[i];
    const outcome = crawlers.find((r) => r.token === c.token)?.live?.outcome;
    if ((outcome === "blocked" || outcome === "reduced") && !(res instanceof Error) && res.body) {
      crawlerViews[c.token] = extractView(res.body);
    }
  });

  if (page.status >= 400) score = Math.min(score, 25);
  score = Math.round(Math.max(0, Math.min(100, score)));

  const summary =
    score >= 80
      ? "AI crawlers can reach and read this page."
      : score >= 50
        ? "AI crawlers can mostly see this page, with issues worth fixing."
        : "AI crawlers will struggle to see this page.";

  const order: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2, info: 3 };
  checks.sort((a, b) => order[a.status] - order[b.status]);

  return {
    url: input.href,
    finalUrl: page.url,
    checkedAt: new Date().toISOString(),
    score,
    summary,
    page: {
      status: page.status,
      ms: page.ms,
      contentType,
      redirects: page.redirects,
      title: signals.title,
      description: signals.description,
      canonical: signals.canonical,
      lang: signals.lang,
      h1: signals.h1,
      words,
      jsonLdTypes: signals.jsonLdTypes,
    },
    robots: {
      url: `${origin}/robots.txt`,
      state: robotsState,
      httpStatus: robotsRes instanceof Error ? null : robotsRes.status,
      sitemaps: robots.sitemaps,
    },
    view: extractView(pageIsHtml ? page.body : ""),
    crawlerViews,
    crawlers,
    directives,
    checks,
  };
}
