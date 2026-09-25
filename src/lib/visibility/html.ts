/**
 * What a crawler that does not run JavaScript can read from a page.
 *
 * Regex-based on purpose: the input is the raw HTML response, and the
 * question is what text and tags are in it before any script runs. A full
 * DOM parser would add weight without changing that answer.
 */

export type RobotsDirective = {
  /** "robots" for everyone, otherwise the bot the directive names. */
  scope: string;
  directive: string;
  source: "meta" | "header";
};

export type PageSignals = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  h1: string[];
  words: number;
  scripts: number;
  jsonLdTypes: string[];
  hasOpenGraph: boolean;
  /** An empty framework mount point such as `<div id="root"></div>`. */
  emptyAppShell: boolean;
  /** A "you need to enable JavaScript" style message. */
  jsRequiredNotice: boolean;
  directives: RobotsDirective[];
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–",
  hellip: "…", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z_:][\w:.-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  // Skip the tag name itself.
  const body = tag.replace(/^<\s*[\w-]+/, "").replace(/\/?>$/, "");
  for (const m of body.matchAll(pattern)) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function stripTags(html: string): string {
  return collapse(decodeEntities(html.replace(/<[^>]*>/g, " ")));
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/** Word-aware count, so CJK text is not counted as one giant word. */
function countWords(text: string): number {
  let count = 0;
  for (const segment of segmenter.segment(text)) if (segment.isWordLike) count++;
  return count;
}

function jsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    const type = record["@type"];
    if (typeof type === "string") types.add(type);
    if (Array.isArray(type)) type.forEach((t) => typeof t === "string" && types.add(t));
    if (record["@graph"]) collect(record["@graph"]);
  };

  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of scripts) {
    try {
      collect(JSON.parse(body));
    } catch {
      // Invalid JSON-LD is ignored by search engines too.
    }
  }
  return [...types];
}

/** Parses an X-Robots-Tag header, which may scope directives to one bot: `googlebot: noindex`. */
export function headerDirectives(value: string | undefined): RobotsDirective[] {
  if (!value) return [];
  const out: RobotsDirective[] = [];
  let scope = "robots";
  // Directives whose value follows a colon, so they are not mistaken for a bot name.
  const valued = /^(max-snippet|max-image-preview|max-video-preview|unavailable_after)$/i;

  for (const part of value.split(",")) {
    let item = part.trim();
    const scoped = item.match(/^([\w-]+)\s*:\s*(.+)$/);
    if (scoped && !valued.test(scoped[1])) {
      scope = scoped[1].toLowerCase();
      item = scoped[2].trim();
    }
    if (item) out.push({ scope, directive: item.toLowerCase(), source: "header" });
  }
  return out;
}

const stripComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, "");

/**
 * The part of the document a crawler reads as content: the body, minus
 * anything that is code rather than text. <noscript> is kept, because a
 * crawler that skips scripts reads what is inside it.
 */
function readableBody(withoutComments: string): string {
  const body =
    withoutComments.match(/<body\b[^>]*>([\s\S]*?)(<\/body>|$)/i)?.[1] ??
    withoutComments.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, "");
  return body.replace(/<(script|style|template|svg|iframe|object|canvas)\b[\s\S]*?<\/\1>/gi, " ");
}

export function extractSignals(html: string): PageSignals {
  const withoutComments = stripComments(html);

  let title: string | null = null;
  const titleMatch = withoutComments.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = stripTags(titleMatch[1]) || null;

  let description: string | null = null;
  let hasOpenGraph = false;
  const directives: RobotsDirective[] = [];

  for (const [tag] of withoutComments.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag);
    const name = (attrs.name ?? "").toLowerCase();
    const content = attrs.content ?? "";
    if (name === "description" && !description) description = collapse(content) || null;
    if ((attrs.property ?? "").toLowerCase().startsWith("og:")) hasOpenGraph = true;

    // Any bot can be addressed by name (`<meta name="gptbot" ...>`), so every
    // meta whose content looks like indexing directives is kept.
    if (name && /\b(noindex|nofollow|none|nosnippet|noarchive|noai|noimageai|max-snippet)\b/i.test(content)) {
      for (const directive of content.split(",")) {
        const d = directive.trim().toLowerCase();
        if (d) directives.push({ scope: name, directive: d, source: "meta" });
      }
    }
  }

  let canonical: string | null = null;
  for (const [tag] of withoutComments.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(tag);
    if ((attrs.rel ?? "").toLowerCase().split(/\s+/).includes("canonical") && attrs.href) {
      canonical = attrs.href;
      break;
    }
  }

  const htmlTag = withoutComments.match(/<html\b[^>]*>/i)?.[0];
  const lang = htmlTag ? parseAttributes(htmlTag).lang || null : null;

  const h1 = [...withoutComments.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => stripTags(m[1]))
    .filter(Boolean);

  const scripts = (withoutComments.match(/<script\b/gi) ?? []).length;

  const text = stripTags(
    readableBody(withoutComments).replace(/<\/(p|div|li|h[1-6]|section|article|br|tr|td|th|blockquote)>/gi, "$& "),
  );

  const emptyAppShell =
    /<div\b[^>]*\bid\s*=\s*["']?(root|app|__next|__nuxt|svelte|q-app|ember-application)["']?[^>]*>\s*<\/div>/i.test(
      withoutComments,
    );
  const jsRequiredNotice =
    /(enable|turn on|requires?)\s+javascript|javascript (is )?(required|disabled)/i.test(text);

  return {
    title,
    description,
    canonical,
    lang,
    h1,
    words: countWords(text),
    scripts,
    jsonLdTypes: jsonLdTypes(withoutComments),
    hasOpenGraph,
    emptyAppShell,
    jsRequiredNotice,
    directives,
  };
}

/**
 * Signs that a response is a bot challenge or block page rather than the site.
 *
 * Only markers that appear on the challenge page itself are listed. Vendor
 * names such as "challenge-platform" or "datadome" also appear in the scripts
 * those services inject into ordinary pages, so they would flag healthy sites.
 */
export function looksLikeChallenge(html: string): boolean {
  return /cf_chl_opt|cf-chl-|<title>\s*(just a moment|attention required|access denied|verify you are human)|_incapsula_resource|px-captcha|captcha-delivery\.com|ddos-guard/i.test(
    html.slice(0, 60_000),
  );
}

/* ------------------------------------------------------------------------ */
/* Crawler's-eye view                                                        */
/* ------------------------------------------------------------------------ */

export type ViewPart = { text: string; href?: string };

export type ViewBlock =
  | { kind: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "li" | "quote" | "code"; parts: ViewPart[] }
  | { kind: "img"; alt: string | null };

export type PageView = {
  blocks: ViewBlock[];
  /** More content existed than the view keeps. */
  truncated: boolean;
  source: string;
  sourceTruncated: boolean;
};

type TextKind = Exclude<ViewBlock["kind"], "img">;

/** Elements that start a new line of text. Everything else is inline. */
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "body", "caption", "dd", "details", "div", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header",
  "hr", "li", "main", "nav", "noscript", "ol", "p", "pre", "section", "summary", "table", "td", "th",
  "tr", "ul", "br",
]);
const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const KIND_OF: Record<string, TextKind> = {
  h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6",
  li: "li", blockquote: "quote", pre: "code",
};

/**
 * Formatting that sits inside a word or sentence. Any other tag between two
 * words is treated as a gap, because sites often lay out separate labels as
 * adjacent <span>s with no whitespace and rely on CSS to separate them.
 */
const INLINE_FORMAT = new Set([
  "abbr", "b", "bdi", "bdo", "cite", "code", "data", "del", "dfn", "em", "i", "ins", "kbd", "mark",
  "q", "s", "small", "strong", "sub", "sup", "time", "u", "var", "wbr",
]);

const MAX_BLOCKS = 600;
const MAX_CHARS = 60_000;
const MAX_SOURCE = 120_000;

/**
 * Rebuilds the page as a crawler that does not run JavaScript receives it:
 * text in reading order, with headings, list items, links and image alt text
 * kept, and everything visual dropped.
 *
 * The output is plain data. The page's HTML is never rendered as HTML.
 */
export function extractView(html: string): PageView {
  const body = readableBody(stripComments(html));
  const blocks: ViewBlock[] = [];
  const stack: string[] = [];
  let parts: ViewPart[] = [];
  let href: string | undefined;
  let chars = 0;
  let truncated = false;
  let gap = false;

  const kind = (): TextKind => {
    for (let i = stack.length - 1; i >= 0; i--) if (KIND_OF[stack[i]]) return KIND_OF[stack[i]];
    return "p";
  };
  const inPre = () => stack.includes("pre");

  const flush = () => {
    const k = kind();
    const cleaned = parts
      .map((p) => ({ ...p, text: k === "code" ? p.text : p.text.replace(/\s+/g, " ") }))
      .filter((p) => p.text.length > 0);
    parts = [];
    if (k !== "code") {
      // Join the parts as one run of text, so spacing between them collapses too.
      for (let i = 1; i < cleaned.length; i++) {
        if (/\s$/.test(cleaned[i - 1].text)) cleaned[i].text = cleaned[i].text.replace(/^\s+/, "");
      }
      if (cleaned[0]) cleaned[0].text = cleaned[0].text.replace(/^\s+/, "");
      const last = cleaned.at(-1);
      if (last) last.text = last.text.replace(/\s+$/, "");
    }
    const kept = cleaned.filter((p) => p.text.trim().length > 0 || (k === "code" && p.text.length > 0));
    if (kept.length === 0) return;
    if (k === "code") kept[0].text = kept[0].text.replace(/^\n+/, "");
    blocks.push({ kind: k, parts: kept });
    chars += kept.reduce((n, p) => n + p.text.length, 0);
  };

  for (const m of body.matchAll(/<(\/?)([a-zA-Z][\w:-]*)([^>]*)>|([^<]+)/g)) {
    if (blocks.length >= MAX_BLOCKS || chars >= MAX_CHARS) {
      truncated = true;
      break;
    }

    if (m[4] !== undefined) {
      let text = decodeEntities(m[4]);
      const prev = parts.at(-1);
      if (gap && prev && /[\p{L}\p{N}]$/u.test(prev.text) && /^[\p{L}\p{N}]/u.test(text)) text = ` ${text}`;
      gap = false;
      if (prev && prev.href === href) prev.text += text;
      else parts.push(href ? { text, href } : { text });
      continue;
    }

    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (!INLINE_FORMAT.has(tag)) gap = true;

    if (tag === "a") {
      href = closing ? undefined : parseAttributes(m[0]).href || undefined;
      continue;
    }

    if (tag === "img" && !closing) {
      const alt = parseAttributes(m[0]).alt;
      // alt="" marks an image as decorative on purpose; it carries nothing to read.
      if (alt === "") continue;
      flush();
      blocks.push({ kind: "img", alt: alt ? collapse(alt) : null });
      continue;
    }

    if (tag === "br" && inPre()) {
      parts.push({ text: "\n" });
      continue;
    }

    if (!BLOCK_TAGS.has(tag)) continue;
    flush();
    if (closing) {
      const index = stack.lastIndexOf(tag);
      if (index !== -1) stack.length = index;
    } else if (!VOID_TAGS.has(tag) && !m[3].trimEnd().endsWith("/")) {
      stack.push(tag);
    }
  }
  if (!truncated) flush();

  return {
    blocks,
    truncated,
    source: html.length > MAX_SOURCE ? html.slice(0, MAX_SOURCE) : html,
    sourceTruncated: html.length > MAX_SOURCE,
  };
}
