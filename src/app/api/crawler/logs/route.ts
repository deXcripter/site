import type { NextRequest } from "next/server";
import { recentHits, renderVerdicts } from "@/lib/crawler-log";

/**
 * Public, read-only view of the crawler log.
 *
 * Safe to expose: the table stores no IP addresses, no cookies and no
 * identifiers. Every column returned here is either a bot label, a coarse
 * network/country descriptor, or a request path.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "100",
    10,
  );

  try {
    const [hits, verdicts] = await Promise.all([
      recentHits(limit),
      renderVerdicts(),
    ]);

    return Response.json(
      { hits, verdicts, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[crawler/logs] query failed:", err);
    return Response.json(
      { error: "log query failed", hits: [], verdicts: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
