/**
 * BigQuery-backed store for crawler hits.
 *
 * Writes use parameterised INSERT statements rather than the streaming API,
 * because BigQuery's sandbox tier (billing disabled) does not permit streaming
 * inserts. If billing is enabled later, switching to the Storage Write API
 * would reduce per-row cost and latency.
 */

import { query, tableRef, bigQueryConfig } from "@/lib/bigquery";
import { BOT_SIGNATURES, botMeta, type BotKind } from "@/lib/bots";
import type { VerifyStatus } from "@/lib/bot-ranges";

export type Signal = "edge" | "js-fetch";

export type CrawlerHit = {
  ts: string;
  request_id: string;
  signal: Signal;
  host: string;
  path: string;
  method: string;
  user_agent: string;
  bot_name: string;
  bot_vendor: string;
  is_ai_bot: 0 | 1;
  /** Kept as 0/1 so the existing column type is unchanged; 1 only when `verify_status` is "verified". */
  verified: 0 | 1;
  /** Why the row is or is not verified. See `VerifyStatus`. */
  verify_status: VerifyStatus;
  asn: number;
  asn_org: string;
  country: string;
  cf_ray: string;
};

const TABLE = "crawler_hits";

/** True when credentials are present, so callers can skip work cheaply. */
export function isConfigured(): boolean {
  return bigQueryConfig() !== null;
}

/** ISO-8601 UTC, which BigQuery accepts directly as a TIMESTAMP parameter. */
export function chTimestamp(date = new Date()): string {
  return date.toISOString();
}

/** Append one hit. Never throws: logging must not break a page response. */
export async function recordHit(hit: CrawlerHit): Promise<void> {
  if (!isConfigured()) return;

  const sql = `
    INSERT INTO ${tableRef(TABLE)}
      (ts, request_id, signal, host, path, method, user_agent,
       bot_name, bot_vendor, is_ai_bot, verified, verify_status, asn, asn_org, country, cf_ray)
    VALUES
      (@ts, @request_id, @signal, @host, @path, @method, @user_agent,
       @bot_name, @bot_vendor, @is_ai_bot, @verified, @verify_status, @asn, @asn_org, @country, @cf_ray)`;

  try {
    await query(sql, [
      { name: "ts", type: "TIMESTAMP", value: hit.ts },
      { name: "request_id", type: "STRING", value: hit.request_id },
      { name: "signal", type: "STRING", value: hit.signal },
      { name: "host", type: "STRING", value: hit.host },
      { name: "path", type: "STRING", value: hit.path },
      { name: "method", type: "STRING", value: hit.method },
      { name: "user_agent", type: "STRING", value: hit.user_agent },
      { name: "bot_name", type: "STRING", value: hit.bot_name },
      { name: "bot_vendor", type: "STRING", value: hit.bot_vendor },
      { name: "is_ai_bot", type: "INT64", value: hit.is_ai_bot },
      { name: "verified", type: "INT64", value: hit.verified },
      { name: "verify_status", type: "STRING", value: hit.verify_status },
      { name: "asn", type: "INT64", value: hit.asn },
      { name: "asn_org", type: "STRING", value: hit.asn_org },
      { name: "country", type: "STRING", value: hit.country },
      { name: "cf_ray", type: "STRING", value: hit.cf_ray },
    ]);
  } catch (err) {
    console.error("[crawler-log] insert failed:", err);
  }
}

export type PublicLogRow = {
  /**
   * Opaque keyset position for this row, also used by the client as a stable
   * identity when merging newly-arrived hits into an already-scrolled list.
   */
  cursor: string;
  ts: string;
  signal: string;
  bot_name: string;
  bot_vendor: string;
  /** "training" and "on-demand" are AI; "search" and "other" are not. */
  kind: BotKind;
  is_ai_bot: number;
  verified: number;
  verify_status: string;
  country: string;
  path: string;
  user_agent: string;
};

export type HitPage = {
  rows: PublicLogRow[];
  /** Pass back as `cursor` to fetch the next batch. Null when exhausted. */
  nextCursor: string | null;
  /** Totals for the whole table, not just this page. Only on the first page. */
  totals: { ai: number; crawlers: number } | null;
};

export type HitFilter = "ai" | "all";

/**
 * Uptime monitors are excluded at the query level.
 *
 * They are not crawlers, they hit every few minutes, and left in they
 * outnumber every real bot several times over — which would mean paging
 * through hundreds of monitor rows to reach the crawlers this lab is about.
 *
 * Both the name and the user agent are checked. Rows logged before monitors
 * had their own signatures were stored as "Generic Bot", so a name-only test
 * would miss the entire backlog; the user-agent test catches those without
 * rewriting history.
 */
const MONITORS = BOT_SIGNATURES.filter((s) => s.kind === "monitor");

/**
 * Values are compile-time constants from BOT_SIGNATURES, never user input, but
 * quotes and regex metacharacters are stripped anyway so that adding an entry
 * cannot break the statement.
 */
const sqlSafe = (value: string) => value.replace(/[^\w .:/-]/g, "");

const MONITOR_SQL_LIST = MONITORS.map((m) => `'${sqlSafe(m.name)}'`).join(", ");

const MONITOR_UA_PATTERN = MONITORS.map((m) => sqlSafe(m.token)).join("|");

/** Shared by the page query and the totals, so the two can never disagree. */
const EXCLUDE_MONITORS = `bot_name NOT IN (${MONITOR_SQL_LIST})
      AND NOT REGEXP_CONTAINS(user_agent, r'(?i)${MONITOR_UA_PATTERN}')`;

/**
 * Encode/decode a keyset position.
 *
 * Offset paging would skip or repeat rows whenever a new hit landed between
 * two requests, which on a live log is constantly. A (timestamp, request_id)
 * keyset is stable under inserts: it names a row, not a position.
 *
 * `request_id` is a UUID this app generates per request. It identifies nothing
 * about a visitor, and is the tiebreak for hits sharing a millisecond.
 */
function encodeCursor(tsMicros: string, requestId: string): string {
  return Buffer.from(`${tsMicros}:${requestId}`).toString("base64url");
}

function decodeCursor(
  cursor: string,
): { micros: number; requestId: string } | null {
  try {
    const raw = Buffer.from(cursor, "base64url").toString("utf8");
    const split = raw.indexOf(":");
    if (split === -1) return null;

    const micros = Number(raw.slice(0, split));
    const requestId = raw.slice(split + 1);
    if (!Number.isSafeInteger(micros) || !requestId) return null;

    return { micros, requestId };
  } catch {
    return null;
  }
}

/** Totals across the whole log, so the UI can say "showing N of M" honestly. */
async function hitTotals(): Promise<{ ai: number; crawlers: number }> {
  const sql = `
    SELECT
      COUNTIF(is_ai_bot = 1) AS ai,
      COUNT(*) AS crawlers
    FROM ${tableRef(TABLE)}
    WHERE ${EXCLUDE_MONITORS}`;

  const [row] = await query(sql);
  return {
    ai: Number(row?.ai ?? 0),
    crawlers: Number(row?.crawlers ?? 0),
  };
}

/**
 * One page of recent hits, newest first.
 *
 * Only allow-listed columns are selected. No IP addresses are stored, so
 * nothing here identifies an individual visitor.
 */
export async function recentHits({
  limit = 50,
  cursor = null,
  filter = "all",
}: {
  limit?: number;
  cursor?: string | null;
  filter?: HitFilter;
} = {}): Promise<HitPage> {
  if (!isConfigured()) return { rows: [], nextCursor: null, totals: null };

  const capped = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  const position = cursor ? decodeCursor(cursor) : null;

  const params: Parameters<typeof query>[1] = [
    // One extra row is fetched purely to learn whether another page exists,
    // then dropped before returning.
    { name: "limit", type: "INT64", value: capped + 1 },
  ];

  const conditions = [EXCLUDE_MONITORS];

  if (filter === "ai") conditions.push("is_ai_bot = 1");

  if (position) {
    // The first comparison is redundant with the second but lets BigQuery
    // prune day partitions instead of scanning the whole table.
    conditions.push(`ts <= TIMESTAMP_MICROS(@cursor_micros)`);
    conditions.push(
      `(UNIX_MICROS(ts) < @cursor_micros
        OR (UNIX_MICROS(ts) = @cursor_micros AND request_id < @cursor_id))`,
    );
    params.push({ name: "cursor_micros", type: "INT64", value: position.micros });
    params.push({ name: "cursor_id", type: "STRING", value: position.requestId });
  }

  // The formatted timestamp is deliberately NOT aliased `ts`: an alias shadows
  // the column in ORDER BY, which would sort by a second-precision string while
  // the cursor compares microseconds. Rows sharing a second would then come
  // back out of order, and the next cursor would skip and repeat them.
  const sql = `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', ts) AS ts_display,
      UNIX_MICROS(ts) AS ts_micros,
      request_id,
      signal, bot_name, bot_vendor, is_ai_bot, verified,
      IFNULL(verify_status, '') AS verify_status, country, path, user_agent
    FROM ${tableRef(TABLE)}
    WHERE ${conditions.join("\n      AND ")}
    ORDER BY ts DESC, request_id DESC
    LIMIT @limit`;

  const [rows, totals] = await Promise.all([
    query(sql, params),
    // Only worth the extra scan on the first page; later pages reuse it.
    position ? Promise.resolve(null) : hitTotals(),
  ]);

  const hasMore = rows.length > capped;
  const page = hasMore ? rows.slice(0, capped) : rows;

  const mapped = page.map((r) => ({
    cursor: encodeCursor(r.ts_micros ?? "0", r.request_id ?? ""),
    ts: r.ts_display ?? "",
    signal: r.signal ?? "",
    bot_name: r.bot_name ?? "",
    bot_vendor: r.bot_vendor ?? "",
    kind: botMeta(r.bot_name ?? "").kind,
    is_ai_bot: Number(r.is_ai_bot ?? 0),
    verified: Number(r.verified ?? 0),
    verify_status: r.verify_status || (Number(r.verified ?? 0) === 1 ? "verified" : ""),
    country: r.country ?? "",
    path: r.path ?? "",
    user_agent: r.user_agent ?? "",
  }));

  return {
    rows: mapped,
    nextCursor: hasMore ? mapped[mapped.length - 1].cursor : null,
    totals,
  };
}

export type RenderVerdict = {
  bot_name: string;
  bot_vendor: string;
  kind: BotKind;
  is_ai_bot: number;
  requests: number;
  js_executions: number;
  verified_requests: number;
  /** JS executions from requests that passed the published-range check. */
  verified_js_executions: number;
  last_seen: string;
};

/** The only path carrying JavaScript probes, so the only fair test of rendering. */
export const LAB_PATH = "/lab/ai-crawler";

/**
 * The core result: per bot, how many times it requested the lab page versus how
 * many times its JavaScript actually ran. Zero executions against a positive
 * request count is a bot that read the HTML and ignored the script.
 *
 * Restricted to the lab page on purpose. Other pages carry no probe, so a bot
 * that only ever visited the homepage would otherwise be reported as "no JS
 * execution" when it was never given a script to run.
 */
export async function renderVerdicts(): Promise<RenderVerdict[]> {
  if (!isConfigured()) return [];

  const sql = `
    SELECT
      bot_name,
      ANY_VALUE(bot_vendor) AS bot_vendor,
      COUNTIF(signal = 'edge') AS requests,
      COUNTIF(signal = 'js-fetch') AS js_executions,
      COUNTIF(signal = 'edge' AND verified = 1) AS verified_requests,
      COUNTIF(signal = 'js-fetch' AND verified = 1) AS verified_js_executions,
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', MAX(ts)) AS last_seen
    FROM ${tableRef(TABLE)}
    WHERE bot_name != '' AND path = @lab_path
    GROUP BY bot_name
    ORDER BY requests DESC`;

  const rows = await query(sql, [
    { name: "lab_path", type: "STRING", value: LAB_PATH },
  ]);

  return rows.map((r) => {
    const meta = botMeta(r.bot_name ?? "");
    return {
      bot_name: r.bot_name ?? "",
      bot_vendor: r.bot_vendor ?? "",
      kind: meta.kind,
      is_ai_bot: meta.ai ? 1 : 0,
      requests: Number(r.requests ?? 0),
      js_executions: Number(r.js_executions ?? 0),
      verified_requests: Number(r.verified_requests ?? 0),
      verified_js_executions: Number(r.verified_js_executions ?? 0),
      last_seen: r.last_seen ?? "",
    };
  });
}
