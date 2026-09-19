import type { NextRequest } from "next/server";
import { recentHits, renderVerdicts, type HitFilter } from "@/lib/crawler-log";

/**
 * Public, read-only view of the crawler log.
 *
 * Safe to expose: the table stores no IP addresses, no cookies and no
 * identifiers. Every column returned here is either a bot label, a coarse
 * network/country descriptor, or a request path.
 *
 * Paged with an opaque keyset cursor rather than an offset, so rows arriving
 * mid-scroll cannot shift or duplicate what the reader has already seen.
 */

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const limit = Number.parseInt(params.get("limit") ?? "50", 10);
  const cursor = params.get("cursor");
  const filter: HitFilter = params.get("filter") === "ai" ? "ai" : "all";

  try {
    // The rendering verdict is an aggregate over the whole table, so it is
    // sent with the first page only and reused while paging.
    const [page, verdicts] = await Promise.all([
      recentHits({ limit, cursor, filter }),
      cursor ? Promise.resolve(null) : renderVerdicts(),
    ]);

    return Response.json(
      {
        hits: page.rows,
        nextCursor: page.nextCursor,
        totals: page.totals,
        verdicts,
        fetchedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[crawler/logs] query failed:", err);
    return Response.json(
      { error: "log query failed", hits: [], nextCursor: null, verdicts: [] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
