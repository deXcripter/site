/**
 * Minimal BigQuery client built on `fetch` and Web Crypto only.
 *
 * No Google SDK is used because this must run in the proxy/edge runtime where
 * Node built-ins are unavailable. Authentication is a service-account JWT
 * exchanged for an access token, which is cached until shortly before expiry.
 *
 * Writes use parameterised DML rather than the streaming API: BigQuery's
 * sandbox (billing disabled) does not allow streaming inserts.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/bigquery";

type Config = {
  projectId: string;
  dataset: string;
  clientEmail: string;
  privateKey: string;
};

export function bigQueryConfig(): Config | null {
  const projectId = process.env.GCP_PROJECT_ID;
  const dataset = process.env.BQ_DATASET;
  const clientEmail = process.env.GCP_SA_EMAIL;
  const privateKey = process.env.GCP_SA_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !dataset || !clientEmail || !privateKey) return null;
  return { projectId, dataset, clientEmail, privateKey };
}

function base64Url(bytes: Uint8Array | string): string {
  const raw =
    typeof bytes === "string"
      ? bytes
      : String.fromCharCode(...Array.from(bytes));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Convert a PEM PKCS#8 private key into a CryptoKey for RS256 signing. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return crypto.subtle.importKey(
    "pkcs8",
    bytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(config: Config): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );

  const key = await importPrivateKey(config.privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${base64Url(new Uint8Array(signature))}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      `token exchange failed (${res.status}): ${data.error_description ?? "unknown"}`,
    );
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return cachedToken.value;
}

export type QueryParam = {
  name: string;
  type: "STRING" | "INT64" | "TIMESTAMP" | "BOOL";
  value: string | number | boolean | null;
};

type QueryResponse = {
  schema?: { fields: { name: string }[] };
  rows?: { f: { v: string | null }[] }[];
  error?: { message: string };
  errors?: { message: string }[];
};

/**
 * Run a parameterised query. Returns rows as plain objects keyed by column.
 * All values arrive as strings, which is how the BigQuery REST API reports them.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** True for transient network faults that are worth retrying. */
function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err.cause as { code?: string } | undefined)?.code ?? "";
  return (
    err.name === "TimeoutError" ||
    err.message === "fetch failed" ||
    ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(code)
  );
}

export async function query(
  sql: string,
  params: QueryParam[] = [],
  retries = 3,
): Promise<Record<string, string | null>[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await runQuery(sql, params);
    } catch (err) {
      lastError = err;
      // A rejected query or auth failure will not succeed on retry.
      if (!isTransient(err)) throw err;
      if (attempt < retries) await sleep(500 * 2 ** attempt);
    }
  }

  throw lastError;
}

async function runQuery(
  sql: string,
  params: QueryParam[],
): Promise<Record<string, string | null>[]> {
  const config = bigQueryConfig();
  if (!config) throw new Error("BigQuery is not configured");

  const token = await accessToken(config);

  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/queries`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: sql,
        useLegacySql: false,
        timeoutMs: 30_000,
        ...(params.length
          ? {
              parameterMode: "NAMED",
              queryParameters: params.map((p) => ({
                name: p.name,
                parameterType: { type: p.type },
                parameterValue: {
                  value: p.value === null ? null : String(p.value),
                },
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(40_000),
    },
  );

  const data = (await res.json()) as QueryResponse;

  if (!res.ok || data.error) {
    const message =
      data.error?.message ?? data.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`BigQuery: ${message}`);
  }

  const fields = data.schema?.fields ?? [];
  return (data.rows ?? []).map((row) => {
    const out: Record<string, string | null> = {};
    fields.forEach((field, i) => {
      out[field.name] = row.f[i]?.v ?? null;
    });
    return out;
  });
}

/** Fully-qualified table reference for use in SQL. */
export function tableRef(table: string): string {
  const config = bigQueryConfig();
  if (!config) throw new Error("BigQuery is not configured");
  return `\`${config.projectId}.${config.dataset}.${table}\``;
}
