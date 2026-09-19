import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { identifyBot } from "@/lib/bots";
import { clientIp, verifyIp } from "@/lib/bot-ranges";
import { chTimestamp, recordHit } from "@/lib/crawler-log";

/**
 * Edge-level request logging for the AI crawler experiment.
 *
 * This runs before any rendering, so it observes every request including
 * those from crawlers that never execute JavaScript. That is the whole point:
 * a hit recorded here with no matching `js-fetch` hit is a bot that read the
 * HTML and ignored the script.
 */

const HEADER_CRAWL_ID = "x-crawl-id";

/**
 * The requesting network's ASN.
 *
 * Recorded for context only. It is NOT used to verify a bot: every AI vendor
 * crawls from rented cloud, so an ASN match means "somebody on Azure/AWS/GCP"
 * rather than "this vendor". Verification is done against published CIDR
 * ranges in `bot-ranges.ts`.
 *
 * Header spelling differs by host, so several candidates are tried.
 */
function readAsn(request: NextRequest): number {
  const raw =
    request.headers.get("x-vercel-ip-as-number") ??
    request.headers.get("x-vercel-ip-asn") ??
    request.headers.get("x-crawl-asn") ??
    "";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readAsnOrg(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-ip-as-organization") ??
    request.headers.get("x-crawl-asn-org") ??
    ""
  ).slice(0, 120);
}

function readCountry(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    ""
  ).slice(0, 8);
}

function readTraceId(request: NextRequest): string {
  return (
    request.headers.get("x-vercel-id") ??
    request.headers.get("cf-ray") ??
    ""
  ).slice(0, 120);
}

/**
 * One-off diagnostic: set CRAWL_DEBUG_HEADERS=1 to print which
 * platform headers actually arrive, then read it back in the host's logs.
 * Values are included only for the network and country fields, which are
 * coarse and non-identifying.
 */
function debugHeaders(request: NextRequest): void {
  if (process.env.CRAWL_DEBUG_HEADERS !== "1") return;

  const interesting = [...request.headers.keys()].filter((key) =>
    /^(x-vercel-ip|x-crawl|cf-)/.test(key),
  );

  console.log(
    "[crawler-debug] platform headers present:",
    interesting.join(", ") || "(none)",
    "| asn:",
    readAsn(request),
    "| country:",
    readCountry(request),
  );
}

export function proxy(request: NextRequest, event: NextFetchEvent) {
  const crawlId = crypto.randomUUID();
  const userAgent = request.headers.get("user-agent") ?? "";
  const bot = identifyBot(userAgent);
  const asn = readAsn(request);
  const ip = clientIp(request.headers);

  if (bot) debugHeaders(request);

  // Only crawlers are logged. Human traffic already goes to the existing
  // analytics tracker, and storing it here would add nothing but risk.
  if (bot) {
    const base = {
      ts: chTimestamp(),
      request_id: crawlId,
      signal: "edge" as const,
      host: request.nextUrl.host,
      path: request.nextUrl.pathname,
      method: request.method,
      user_agent: userAgent.slice(0, 512),
      bot_name: bot.name,
      bot_vendor: bot.vendor,
      is_ai_bot: (bot.ai ? 1 : 0) as 0 | 1,
      asn,
      asn_org: readAsnOrg(request),
      country: readCountry(request),
      cf_ray: readTraceId(request),
    };

    // The range check needs a network fetch on a cold cache, so it runs inside
    // waitUntil alongside the insert: the response is never held up by it.
    // The address is used here and then dropped; only the verdict is stored.
    event.waitUntil(
      verifyIp(bot.sources, ip).then((status) =>
        recordHit({
          ...base,
          verified: (status === "verified" ? 1 : 0) as 0 | 1,
          verify_status: status,
        }),
      ),
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HEADER_CRAWL_ID, crawlId);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Static assets and image optimisation are excluded; they add noise and cost
  // without telling us anything about document rendering.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
