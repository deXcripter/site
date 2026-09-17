/**
 * AI crawler identification.
 *
 * Two distinct kinds of bot matter for rendering tests:
 *  - "training"  : crawls on the vendor's own schedule to build corpora / indexes.
 *  - "on-demand" : fetches a URL because a user just asked about it in a chat.
 *
 * They can behave differently, so they are labelled separately rather than
 * lumped together as "AI".
 */

export type BotKind = "training" | "on-demand" | "search" | "other";

export type BotSignature = {
  /** Case-insensitive token to look for in the User-Agent string. */
  token: string;
  name: string;
  vendor: string;
  kind: BotKind;
  /** Whether this bot belongs to an AI product (vs a classic search engine). */
  ai: boolean;
};

/** Order matters: more specific tokens must precede broader ones. */
export const BOT_SIGNATURES: BotSignature[] = [
  // --- OpenAI ---
  { token: "OAI-SearchBot", name: "OAI-SearchBot", vendor: "OpenAI", kind: "search", ai: true },
  { token: "ChatGPT-User", name: "ChatGPT-User", vendor: "OpenAI", kind: "on-demand", ai: true },
  { token: "GPTBot", name: "GPTBot", vendor: "OpenAI", kind: "training", ai: true },

  // --- Anthropic ---
  { token: "Claude-SearchBot", name: "Claude-SearchBot", vendor: "Anthropic", kind: "search", ai: true },
  { token: "Claude-User", name: "Claude-User", vendor: "Anthropic", kind: "on-demand", ai: true },
  { token: "ClaudeBot", name: "ClaudeBot", vendor: "Anthropic", kind: "training", ai: true },
  { token: "anthropic-ai", name: "anthropic-ai", vendor: "Anthropic", kind: "training", ai: true },

  // --- Perplexity ---
  { token: "Perplexity-User", name: "Perplexity-User", vendor: "Perplexity", kind: "on-demand", ai: true },
  { token: "PerplexityBot", name: "PerplexityBot", vendor: "Perplexity", kind: "training", ai: true },

  // --- Google ---
  { token: "Google-Extended", name: "Google-Extended", vendor: "Google", kind: "training", ai: true },
  { token: "Google-CloudVertexBot", name: "Google-CloudVertexBot", vendor: "Google", kind: "training", ai: true },
  { token: "Googlebot", name: "Googlebot", vendor: "Google", kind: "search", ai: false },

  // --- Microsoft ---
  { token: "BingPreview", name: "BingPreview", vendor: "Microsoft", kind: "search", ai: false },
  { token: "bingbot", name: "Bingbot", vendor: "Microsoft", kind: "search", ai: false },

  // --- Apple ---
  { token: "Applebot-Extended", name: "Applebot-Extended", vendor: "Apple", kind: "training", ai: true },
  { token: "Applebot", name: "Applebot", vendor: "Apple", kind: "search", ai: false },

  // --- Meta / ByteDance / Amazon ---
  { token: "meta-externalagent", name: "meta-externalagent", vendor: "Meta", kind: "training", ai: true },
  { token: "FacebookBot", name: "FacebookBot", vendor: "Meta", kind: "training", ai: true },
  { token: "Bytespider", name: "Bytespider", vendor: "ByteDance", kind: "training", ai: true },
  { token: "Amazonbot", name: "Amazonbot", vendor: "Amazon", kind: "training", ai: true },

  // --- Others ---
  { token: "MistralAI-User", name: "MistralAI-User", vendor: "Mistral", kind: "on-demand", ai: true },
  { token: "DuckAssistBot", name: "DuckAssistBot", vendor: "DuckDuckGo", kind: "training", ai: true },
  { token: "CCBot", name: "CCBot", vendor: "Common Crawl", kind: "training", ai: true },
  { token: "cohere-ai", name: "cohere-ai", vendor: "Cohere", kind: "training", ai: true },
  { token: "Ai2Bot", name: "Ai2Bot", vendor: "Allen Institute", kind: "training", ai: true },
  { token: "YouBot", name: "YouBot", vendor: "You.com", kind: "training", ai: true },
  { token: "Diffbot", name: "Diffbot", vendor: "Diffbot", kind: "training", ai: true },
  { token: "Timpibot", name: "Timpibot", vendor: "Timpi", kind: "training", ai: true },
  { token: "ImagesiftBot", name: "ImagesiftBot", vendor: "ImageSift", kind: "training", ai: true },

  // --- Headless / tooling (renders JS; useful control group) ---
  { token: "HeadlessChrome", name: "HeadlessChrome", vendor: "Chromium", kind: "other", ai: false },
  { token: "Chrome-Lighthouse", name: "Lighthouse", vendor: "Google", kind: "other", ai: false },
];

export type BotMatch = {
  name: string;
  vendor: string;
  kind: BotKind;
  ai: boolean;
};

/** Identify a bot from its User-Agent, or null when it looks like a browser. */
export function identifyBot(userAgent: string): BotMatch | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  for (const sig of BOT_SIGNATURES) {
    if (ua.includes(sig.token.toLowerCase())) {
      return { name: sig.name, vendor: sig.vendor, kind: sig.kind, ai: sig.ai };
    }
  }

  // Generic catch-all so unknown crawlers are not silently treated as humans.
  if (/\b(bot|crawler|spider|crawl)\b/.test(ua)) {
    return { name: "Generic Bot", vendor: "", kind: "other", ai: false };
  }

  return null;
}

/** Look up a bot's classification from the name stored in the log. */
export function botMeta(name: string): { kind: BotKind; ai: boolean } {
  const sig = BOT_SIGNATURES.find((entry) => entry.name === name);
  if (sig) return { kind: sig.kind, ai: sig.ai };
  return { kind: "other", ai: false };
}

/**
 * Autonomous System numbers published by AI vendors for their crawlers.
 * A User-Agent alone is trivially spoofed, so an ASN match is what makes a hit
 * defensible. Absence of a match means "unverified", not "fake".
 */
export const VENDOR_ASNS: Record<string, number[]> = {
  OpenAI: [20473, 396982],
  Anthropic: [399358, 14618, 16509],
  Perplexity: [396982, 14061],
  Google: [15169, 396982],
  Microsoft: [8075],
  Apple: [714, 6185],
  Meta: [32934],
  ByteDance: [396986, 138699],
  Amazon: [16509, 14618],
};

/** True when the request's ASN is one the claimed vendor is known to use. */
export function verifyVendorAsn(vendor: string, asn: number): boolean {
  if (!vendor || !asn) return false;
  return (VENDOR_ASNS[vendor] ?? []).includes(asn);
}
