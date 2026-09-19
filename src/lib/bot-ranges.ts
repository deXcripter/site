/**
 * Crawler verification against vendor-published IP ranges.
 *
 * A User-Agent is trivially spoofed, so it cannot on its own support the claim
 * this lab exists to test ("this AI bot executed JavaScript"). An unverified
 * row is worthless for that purpose: anyone could send `ClaudeBot/1.0` from a
 * VM, run the probe, and produce a false positive.
 *
 * Verification therefore matches the request IP against the CIDR list the
 * vendor publishes for its own crawlers.
 *
 * WHY PREFIXES AND NOT ASNs
 * -------------------------
 * The previous implementation compared the requesting ASN to a per-vendor
 * allowlist. That cannot work for any AI vendor, because all of them crawl
 * from rented cloud:
 *
 *   - OpenAI's crawlers come from AS8075 (Microsoft Azure)
 *   - Anthropic's from AS396982 (GCP), AS16509 (AWS) and AS8075
 *   - Perplexity's from AS14618 (Amazon AES)
 *
 * An ASN match would mean "somebody on Azure", which is millions of tenants.
 * A prefix match means "inside the block that vendor was allocated" — e.g.
 * Anthropic's 216.73.216.0/22 is announced by AWS but assigned to Anthropic
 * alone, so no other EC2 customer can be issued an address inside it. That is
 * the distinction that makes this check meaningful.
 *
 * LIMITS, worth stating before citing any of this publicly:
 *
 *  1. This is a vendor's claim about its own addresses, not proof. It is only
 *     as good as the vendor keeping its file current.
 *  2. The lists move. `chatgpt-user.json` regenerates daily. They are fetched
 *     at runtime and cached briefly, never vendored, because a stale copy
 *     reintroduces exactly the false negatives this replaced.
 *  3. Vendors that publish nothing cannot be checked at all. Those report
 *     "unverifiable", which is a different statement from "unverified" and is
 *     kept distinct on purpose.
 */

/** Published CIDR lists, keyed by an id that bot signatures refer to. */
export const RANGE_SOURCES: Record<string, string> = {
  anthropic: "https://claude.com/crawling/bots.json",
  "openai-gptbot": "https://openai.com/gptbot.json",
  "openai-searchbot": "https://openai.com/searchbot.json",
  "openai-user": "https://openai.com/chatgpt-user.json",
  "perplexity-bot": "https://www.perplexity.ai/perplexitybot.json",
  "perplexity-user": "https://www.perplexity.ai/perplexity-user.json",
  googlebot:
    "https://developers.google.com/static/search/apis/ipranges/googlebot.json",
  "google-special":
    "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json",
  "google-user":
    "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers-google.json",
  bingbot: "https://www.bing.com/toolbox/bingbot.json",
  applebot: "https://search.developer.apple.com/applebot.json",
  duckassistbot: "https://duckduckgo.com/duckassistbot.json",
};

/**
 * Outcome of a verification attempt. Four states rather than a boolean,
 * because collapsing them is what made the old log misleading:
 *
 *  - `verified`     : IP is inside a range the vendor publishes.
 *  - `unverified`   : vendor publishes ranges and the IP is not in them.
 *                     Treat as a probable impostor.
 *  - `unverifiable` : vendor publishes no ranges, so no check is possible.
 *  - `no-ip`        : the platform gave us no client address to check.
 */
export type VerifyStatus = "verified" | "unverified" | "unverifiable" | "no-ip";

/** An address as raw bytes: 4 for IPv4, 16 for IPv6. */
type Addr = Uint8Array;

type Prefix = { bytes: Addr; bits: number };

type CacheEntry = {
  prefixes: Prefix[];
  fetchedAt: number;
  /** Set when the last refresh failed, so stale data is still usable. */
  stale: boolean;
};

/** Six hours. Long enough to be cheap, short enough to track vendor edits. */
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Proxy runs in the Node.js runtime as of Next 16, so module scope survives
 * between requests within an instance. It is still only a cache: a cold or
 * evicted isolate simply refetches. Nothing depends on it being shared.
 */
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry | null>>();

/**
 * Parse an IPv4 or IPv6 address into bytes, or null when unparseable.
 *
 * Bytes rather than a single integer because a v6 address needs 128 bits,
 * which would otherwise require BigInt and a higher compile target than the
 * rest of this project uses.
 */
function ipToBytes(ip: string): Addr | null {
  const addr = ip.trim();
  if (!addr) return null;

  if (!addr.includes(":")) {
    const octets = addr.split(".");
    if (octets.length !== 4) return null;

    const bytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(octets[i])) return null;
      const n = Number(octets[i]);
      if (n > 255) return null;
      bytes[i] = n;
    }
    return bytes;
  }

  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is compared as IPv4, since that is the
  // form the published lists use.
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return ipToBytes(mapped[1]);

  const doubleColon = addr.indexOf("::");
  const [head, tail] =
    doubleColon === -1 ? [addr, ""] : [addr.slice(0, doubleColon), addr.slice(doubleColon + 2)];

  const headParts = head ? head.split(":").filter(Boolean) : [];
  const tailParts = tail ? tail.split(":").filter(Boolean) : [];

  let groups: string[];
  if (doubleColon === -1) {
    groups = headParts;
  } else {
    const fill = 8 - headParts.length - tailParts.length;
    if (fill < 0) return null;
    groups = [...headParts, ...Array(fill).fill("0"), ...tailParts];
  }
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    if (!/^[0-9a-f]{1,4}$/i.test(groups[i])) return null;
    const n = Number.parseInt(groups[i], 16);
    bytes[i * 2] = n >> 8;
    bytes[i * 2 + 1] = n & 0xff;
  }
  return bytes;
}

/** Parse "1.2.3.0/24" into a comparable prefix. */
function parsePrefix(cidr: string): Prefix | null {
  const [addr, bitsRaw] = cidr.split("/");
  const bytes = ipToBytes(addr);
  if (!bytes) return null;

  const width = bytes.length * 8;
  const bits = bitsRaw === undefined ? width : Number.parseInt(bitsRaw, 10);
  if (!Number.isInteger(bits) || bits < 0 || bits > width) return null;

  return { bytes, bits };
}

/** True when `ip` falls inside `prefix`. */
function contains(prefix: Prefix, ip: Addr): boolean {
  // A v4 prefix can never contain a v6 address, or vice versa.
  if (prefix.bytes.length !== ip.length) return false;

  const whole = prefix.bits >> 3;
  for (let i = 0; i < whole; i++) {
    if (prefix.bytes[i] !== ip[i]) return false;
  }

  const rest = prefix.bits & 7;
  if (rest === 0) return true;

  const mask = (0xff << (8 - rest)) & 0xff;
  return (prefix.bytes[whole] & mask) === (ip[whole] & mask);
}

/**
 * Every vendor above serves the same shape: `{ prefixes: [{ ipv4Prefix }] }`.
 * Unknown keys are ignored rather than throwing, so a vendor adding a field
 * cannot break logging.
 */
function parseFeed(body: unknown): Prefix[] {
  const entries = (body as { prefixes?: unknown })?.prefixes;
  if (!Array.isArray(entries)) return [];

  const prefixes: Prefix[] = [];
  for (const entry of entries) {
    const cidr =
      (entry as { ipv4Prefix?: string; ipv6Prefix?: string })?.ipv4Prefix ??
      (entry as { ipv6Prefix?: string })?.ipv6Prefix;
    if (typeof cidr !== "string") continue;
    const parsed = parsePrefix(cidr);
    if (parsed) prefixes.push(parsed);
  }
  return prefixes;
}

async function loadSource(id: string): Promise<CacheEntry | null> {
  const cached = cache.get(id);
  const fresh = cached && Date.now() - cached.fetchedAt < TTL_MS;
  if (fresh) return cached;

  const existing = inFlight.get(id);
  if (existing) return existing;

  const url = RANGE_SOURCES[id];
  if (!url) return null;

  const task = (async (): Promise<CacheEntry | null> => {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json" },
        // Generous because this never blocks a response: the fetch happens
        // inside waitUntil/after, alongside the insert.
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const prefixes = parseFeed(await res.json());
      // An empty list means the endpoint changed shape. Keeping the previous
      // data is safer than treating every genuine crawler as an impostor.
      if (prefixes.length === 0) throw new Error("no prefixes parsed");

      const entry: CacheEntry = { prefixes, fetchedAt: Date.now(), stale: false };
      cache.set(id, entry);
      return entry;
    } catch (err) {
      console.error(`[bot-ranges] ${id} refresh failed:`, err);
      if (cached) {
        // Serve stale rather than downgrading real crawlers to "unverified".
        const entry: CacheEntry = { ...cached, stale: true };
        cache.set(id, entry);
        return entry;
      }
      return null;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, task);
  return task;
}

/**
 * Check an address against the given sources.
 *
 * `sources` is empty for vendors that publish nothing, which is reported as
 * `unverifiable` rather than silently failing the check.
 */
export async function verifyIp(
  sources: readonly string[] | undefined,
  ip: string,
): Promise<VerifyStatus> {
  if (!sources || sources.length === 0) return "unverifiable";

  const parsed = ip ? ipToBytes(ip) : null;
  if (!parsed) return "no-ip";

  const loaded = await Promise.all(sources.map(loadSource));

  // Every source failed with nothing cached: we cannot make a claim either
  // way, so say so instead of asserting the bot is fake.
  if (loaded.every((entry) => entry === null)) return "unverifiable";

  for (const entry of loaded) {
    if (!entry) continue;
    for (const prefix of entry.prefixes) {
      if (contains(prefix, parsed)) return "verified";
    }
  }

  return "unverified";
}

/**
 * The client address, or "" when the platform exposes none.
 *
 * `NextRequest.ip` was removed in Next 15, so this reads the forwarding
 * headers directly. The leftmost `x-forwarded-for` entry is the original
 * client; Vercel rewrites this header itself, so it cannot be spoofed by the
 * caller on this deployment.
 *
 * The address is used for the range check and then discarded — only the
 * resulting status is stored, so the log holds nothing identifying.
 */
export function clientIp(headers: Headers): string {
  const direct =
    headers.get("x-real-ip") ?? headers.get("x-vercel-forwarded-for") ?? "";
  if (direct) return direct.split(",")[0].trim();

  const forwarded = headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim();
}
