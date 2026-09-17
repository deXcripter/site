/**
 * BigQuery-backed store for crawler hits.
 *
 * Writes use parameterised INSERT statements rather than the streaming API,
 * because BigQuery's sandbox tier (billing disabled) does not permit streaming
 * inserts. If billing is enabled later, switching to the Storage Write API
 * would reduce per-row cost and latency.
 */

import { query, tableRef, bigQueryConfig } from "@/lib/bigquery";
import { botMeta, type BotKind } from "@/lib/bots";

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
  verified: 0 | 1;
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
       bot_name, bot_vendor, is_ai_bot, verified, asn, asn_org, country, cf_ray)
    VALUES
      (@ts, @request_id, @signal, @host, @path, @method, @user_agent,
       @bot_name, @bot_vendor, @is_ai_bot, @verified, @asn, @asn_org, @country, @cf_ray)`;

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
  ts: string;
  signal: string;
  bot_name: string;
  bot_vendor: string;
  /** "training" and "on-demand" are AI; "search" and "other" are not. */
  kind: BotKind;
  is_ai_bot: number;
  verified: number;
  asn_org: string;
  country: string;
  path: string;
  user_agent: string;
};

/**
 * Recent hits for the public terminal.
 *
 * Only allow-listed columns are selected. No IP addresses are stored, so
 * nothing here identifies an individual visitor.
 */
export async function recentHits(limit = 100): Promise<PublicLogRow[]> {
  if (!isConfigured()) return [];

  const capped = Math.min(Math.max(Math.trunc(limit) || 100, 1), 500);

  const sql = `
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', ts) AS ts,
      signal, bot_name, bot_vendor, is_ai_bot, verified,
      asn_org, country, path, user_agent
    FROM ${tableRef(TABLE)}
    ORDER BY ts DESC
    LIMIT @limit`;

  const rows = await query(sql, [
    { name: "limit", type: "INT64", value: capped },
  ]);

  return rows.map((r) => ({
    ts: r.ts ?? "",
    signal: r.signal ?? "",
    bot_name: r.bot_name ?? "",
    bot_vendor: r.bot_vendor ?? "",
    kind: botMeta(r.bot_name ?? "").kind,
    is_ai_bot: Number(r.is_ai_bot ?? 0),
    verified: Number(r.verified ?? 0),
    asn_org: r.asn_org ?? "",
    country: r.country ?? "",
    path: r.path ?? "",
    user_agent: r.user_agent ?? "",
  }));
}

export type RenderVerdict = {
  bot_name: string;
  bot_vendor: string;
  kind: BotKind;
  is_ai_bot: number;
  requests: number;
  js_executions: number;
  verified_requests: number;
  last_seen: string;
};

/**
 * The core result: per bot, how many times it requested a page versus how many
 * times its JavaScript actually ran. Zero executions against a positive
 * request count is a bot that read the HTML and ignored the script.
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
      FORMAT_TIMESTAMP('%Y-%m-%d %H:%M:%S', MAX(ts)) AS last_seen
    FROM ${tableRef(TABLE)}
    WHERE bot_name != ''
    GROUP BY bot_name
    ORDER BY requests DESC`;

  const rows = await query(sql);

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
      last_seen: r.last_seen ?? "",
    };
  });
}
