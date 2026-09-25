import type { NextRequest } from "next/server";
import { clientIp } from "@/lib/bot-ranges";
import { analyse, InputError, normaliseInput } from "@/lib/visibility/analyze";
import { FetchError } from "@/lib/visibility/safe-fetch";

/**
 * AI visibility check for the tool at /lab/ai-visibility.
 *
 * Each check makes around eight outbound requests to someone else's site, so
 * callers are rate limited. The limiter lives in instance memory: on a
 * serverless host that makes it per-instance and best-effort, which is enough
 * to stop a single client hammering a target through this endpoint.
 */

export const maxDuration = 30;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);

  if (recent.size > 5_000) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") ?? "";
  if (raw.length > 2_000) {
    return Response.json({ error: "That address is too long" }, { status: 400, headers: noStore });
  }

  let url: URL;
  try {
    url = normaliseInput(raw);
  } catch (err) {
    const message = err instanceof InputError ? err.message : "Invalid address";
    return Response.json({ error: message }, { status: 400, headers: noStore });
  }

  if (rateLimited(clientIp(request.headers) || "unknown")) {
    return Response.json(
      { error: "Too many checks in a short time. Try again in a minute." },
      { status: 429, headers: { ...noStore, "Retry-After": "60" } },
    );
  }

  try {
    const report = await analyse(url);
    return Response.json(report, { headers: noStore });
  } catch (err) {
    if (err instanceof FetchError) {
      const status = err.code === "bad-url" || err.code === "blocked-address" ? 400 : 502;
      return Response.json({ error: `Couldn't reach ${url.hostname}: ${err.message}` }, { status, headers: noStore });
    }
    console.error("[visibility] analysis failed", err);
    return Response.json({ error: "Something went wrong running the check" }, { status: 500, headers: noStore });
  }
}
