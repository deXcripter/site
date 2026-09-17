import { after } from "next/server";
import type { NextRequest } from "next/server";
import { identifyBot, verifyVendorAsn } from "@/lib/bots";
import { chTimestamp, recordHit } from "@/lib/crawler-log";

/**
 * The JavaScript-execution probe.
 *
 * This endpoint is only ever called by client-side script on the lab page.
 * A request here proves the caller ran JavaScript, so any hit recorded with
 * signal `js-fetch` is evidence of rendering.
 *
 * Text is generated locally on purpose: a third-party API would add a
 * cross-origin dependency that could fail and be misread as "no JS support".
 */

const WORDS = [
  "crawler", "render", "payload", "beacon", "latency", "index", "corpus",
  "fetcher", "manifest", "hydrate", "cascade", "token", "signal", "origin",
  "artifact", "traversal", "canonical", "fragment", "snapshot", "directive",
];

function randomSentence(): string {
  const length = 6 + Math.floor(Math.random() * 7);
  const words = Array.from(
    { length },
    () => WORDS[Math.floor(Math.random() * WORDS.length)],
  );
  const sentence = words.join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

function randomText(sentences = 3): string {
  return Array.from({ length: sentences }, randomSentence).join(" ");
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId =
    request.nextUrl.searchParams.get("rid") ??
    request.headers.get("x-crawl-id") ??
    crypto.randomUUID();

  const userAgent = request.headers.get("user-agent") ?? "";
  const bot = identifyBot(userAgent);
  const asnRaw =
    request.headers.get("x-vercel-ip-as-number") ??
    request.headers.get("x-vercel-ip-asn") ??
    request.headers.get("x-crawl-asn") ??
    "";
  const asn = Number.parseInt(asnRaw, 10) || 0;

  if (bot) {
    after(() =>
      recordHit({
        ts: chTimestamp(),
        request_id: requestId,
        signal: "js-fetch",
        host: request.nextUrl.host,
        path: "/lab/ai-crawler",
        method: request.method,
        user_agent: userAgent.slice(0, 512),
        bot_name: bot.name,
        bot_vendor: bot.vendor,
        is_ai_bot: bot.ai ? 1 : 0,
        verified: verifyVendorAsn(bot.vendor, asn) ? 1 : 0,
        asn,
        asn_org:
          request.headers.get("x-vercel-ip-as-organization") ??
          request.headers.get("x-crawl-asn-org") ??
          "",
        country:
          request.headers.get("x-vercel-ip-country") ??
          request.headers.get("cf-ipcountry") ??
          "",
        cf_ray:
          request.headers.get("x-vercel-id") ??
          request.headers.get("cf-ray") ??
          "",
      }),
    );
  }

  return Response.json(
    { requestId, text: randomText(), generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
