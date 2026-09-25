import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import zlib from "node:zlib";
import type { Readable } from "node:stream";
import { site } from "@/lib/site";

/**
 * Outbound HTTP for the visibility checker.
 *
 * The checker fetches whatever URL a visitor types, which makes it an open
 * door into the hosting network unless every hop is checked. `fetch` resolves
 * DNS on its own, so a pre-flight lookup would leave a window for a rebinding
 * attack between the check and the connect. This uses `node:http` instead,
 * with a `lookup` hook that vets the exact addresses the socket connects to.
 *
 * Redirects are followed by hand so each hop gets the same treatment.
 */

const OWN_HOST = new URL(site.url).hostname.replace(/^www\./, "");
const MAX_REDIRECTS = 5;
const MAX_BYTES = 3 * 1024 * 1024;

export class FetchError extends Error {
  constructor(
    public code: "blocked-address" | "bad-url" | "timeout" | "too-many-redirects" | "network",
    message: string,
  ) {
    super(message);
  }
}

export type FetchResult = {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  /** Every URL that answered with a redirect, in order. */
  redirects: string[];
  ms: number;
  truncated: boolean;
};

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv4");
}
for (const [addr, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(addr, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, "ipv4");
  if (family !== 6) return true;

  // IPv4-mapped (::ffff:10.0.0.1) would otherwise slip past the IPv4 list.
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], "ipv4");
  return blocked.check(address, "ipv6");
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family?: number,
) => void;

function safeLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const bad = addresses.find((a) => isBlockedAddress(a.address));
    if (bad || addresses.length === 0) {
      return callback(
        new FetchError("blocked-address", `${hostname} resolves to a private or reserved address`),
        "",
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

/** Rejects anything that is not plain http(s) on the default ports. */
export function assertFetchable(url: URL): void {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new FetchError("bad-url", "Only http and https URLs can be checked");
  }
  if (url.username || url.password) {
    throw new FetchError("bad-url", "URLs with credentials cannot be checked");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchError("bad-url", "Only the standard ports (80 and 443) can be checked");
  }
  // IP literals never reach `lookup`, so they are checked here instead.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new FetchError("blocked-address", "That address is private or reserved");
  }
}

function decoder(encoding: string | undefined): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  switch ((encoding ?? "").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    default:
      return null;
  }
}

function flattenHeaders(raw: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

function requestOnce(
  url: URL,
  userAgent: string,
  deadline: number,
): Promise<{ status: number; headers: Record<string, string>; body: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new FetchError("timeout", "The site took too long to respond"));

    const client = url.protocol === "https:" ? https : http;
    const req = client.request(
      url,
      {
        method: "GET",
        agent: false,
        lookup: safeLookup as unknown as net.LookupFunction,
        headers: {
          "user-agent": userAgent,
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en;q=0.9",
          // Lets this site's proxy skip logging the checker's imitation bots.
          // Sent only here: unknown headers make some WAFs answer 400.
          ...(url.hostname === OWN_HOST || url.hostname.endsWith(`.${OWN_HOST}`) ? { "x-visibility-check": "1" } : {}),
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const headers = flattenHeaders(res.headers);

        // Redirect bodies are irrelevant; drain and hand back the headers.
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers, body: "", truncated: false });
        }

        const inflate = decoder(headers["content-encoding"]);
        const stream: Readable = inflate ? res.pipe(inflate) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;

        stream.on("data", (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > MAX_BYTES) {
            truncated = true;
            chunks.push(chunk.subarray(0, chunk.length - (size - MAX_BYTES)));
            res.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });

        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ status, headers, body: Buffer.concat(chunks).toString("utf8"), truncated });
        };
        const fail = (err: Error) => {
          if (done || truncated) return;
          done = true;
          clearTimeout(timer);
          reject(err instanceof FetchError ? err : new FetchError("network", err.message));
        };
        stream.on("end", finish);
        stream.on("error", fail);
        if (stream !== res) res.on("error", fail);
      },
    );

    const timer = setTimeout(() => {
      req.destroy(new FetchError("timeout", "The site took too long to respond"));
    }, remaining);

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err instanceof FetchError ? err : new FetchError("network", describeNetworkError(err)));
    });
    req.end();
  });
}

function describeNetworkError(err: NodeJS.ErrnoException): string {
  switch (err.code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "That domain does not resolve";
    case "ECONNREFUSED":
      return "The server refused the connection";
    case "ETIMEDOUT":
    case "ENETUNREACH":
    case "EHOSTUNREACH":
      return "Couldn't connect to the server";
    case "ECONNRESET":
      return "The server closed the connection";
    case "CERT_HAS_EXPIRED":
      return "The site's TLS certificate has expired";
    case "ERR_TLS_CERT_ALTNAME_INVALID":
      return "The site's TLS certificate does not match the domain";
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
      return "The site uses a self-signed TLS certificate";
    default:
      return err.message || "The request failed";
  }
}

/** GET a URL, following redirects, with every hop vetted. */
export async function safeFetch(
  input: string | URL,
  { userAgent, timeoutMs = 10_000 }: { userAgent: string; timeoutMs?: number },
): Promise<FetchResult> {
  const started = Date.now();
  const deadline = started + timeoutMs;
  const redirects: string[] = [];
  let url = new URL(input);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertFetchable(url);
    const res = await requestOnce(url, userAgent, deadline);
    const location = res.headers.location;

    if (res.status >= 300 && res.status < 400 && location) {
      redirects.push(url.href);
      url = new URL(location, url);
      continue;
    }

    return { url: url.href, ...res, redirects, ms: Date.now() - started };
  }

  throw new FetchError("too-many-redirects", `More than ${MAX_REDIRECTS} redirects`);
}
