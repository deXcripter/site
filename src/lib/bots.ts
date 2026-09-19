/**
 * AI crawler identification.
 *
 * Two distinct kinds of bot matter for rendering tests:
 *  - "training"  : crawls on the vendor's own schedule to build corpora / indexes.
 *  - "on-demand" : fetches a URL because a user just asked about it in a chat.
 *
 * They can behave differently, so they are labelled separately rather than
 * lumped together as "AI".
 *
 * A name here is only a claim made by the request. It becomes trustworthy only
 * once the address is matched against the vendor's published ranges — see
 * `bot-ranges.ts`, and the `sources` field below that wires the two together.
 */

export type BotKind =
  | "training"
  | "on-demand"
  | "search"
  | "monitor"
  | "other";

export type BotSignature = {
  /** Case-insensitive token to look for in the User-Agent string. */
  token: string;
  name: string;
  vendor: string;
  kind: BotKind;
  /** Whether this bot belongs to an AI product (vs a classic search engine). */
  ai: boolean;
  /**
   * Ids in `RANGE_SOURCES` whose published CIDR lists cover this bot.
   *
   * Omitted when the vendor publishes no list at all. Those bots can never be
   * verified and are reported as "unverifiable" rather than "unverified".
   */
  sources?: string[];
};

/** Order matters: more specific tokens must precede broader ones. */
export const BOT_SIGNATURES: BotSignature[] = [
  // --- OpenAI ---
  // Each OpenAI agent has its own list, so the name is verified, not just the vendor.
  { token: "OAI-SearchBot", name: "OAI-SearchBot", vendor: "OpenAI", kind: "search", ai: true, sources: ["openai-searchbot"] },
  { token: "ChatGPT-User", name: "ChatGPT-User", vendor: "OpenAI", kind: "on-demand", ai: true, sources: ["openai-user"] },
  { token: "GPTBot", name: "GPTBot", vendor: "OpenAI", kind: "training", ai: true, sources: ["openai-gptbot"] },

  // --- Anthropic ---
  // One combined file covers all three agents, so a match proves "Anthropic"
  // but not which agent. The agent name still comes from the User-Agent.
  { token: "Claude-SearchBot", name: "Claude-SearchBot", vendor: "Anthropic", kind: "search", ai: true, sources: ["anthropic"] },
  { token: "Claude-User", name: "Claude-User", vendor: "Anthropic", kind: "on-demand", ai: true, sources: ["anthropic"] },
  { token: "ClaudeBot", name: "ClaudeBot", vendor: "Anthropic", kind: "training", ai: true, sources: ["anthropic"] },
  { token: "anthropic-ai", name: "anthropic-ai", vendor: "Anthropic", kind: "training", ai: true, sources: ["anthropic"] },

  // --- Perplexity ---
  { token: "Perplexity-User", name: "Perplexity-User", vendor: "Perplexity", kind: "on-demand", ai: true, sources: ["perplexity-user"] },
  { token: "PerplexityBot", name: "PerplexityBot", vendor: "Perplexity", kind: "training", ai: true, sources: ["perplexity-bot"] },

  // --- Google ---
  // `Google-Extended` and `Applebot-Extended` are deliberately absent: both are
  // robots.txt opt-out tokens only and are never sent as a User-Agent, so
  // signatures for them could never match. Google's AI training crawl arrives
  // as Googlebot; Apple's as Applebot.
  { token: "Google-CloudVertexBot", name: "Google-CloudVertexBot", vendor: "Google", kind: "training", ai: true, sources: ["google-special"] },
  { token: "Google-InspectionTool", name: "Google-InspectionTool", vendor: "Google", kind: "other", ai: false, sources: ["google-user"] },
  { token: "Googlebot-Image", name: "Googlebot-Image", vendor: "Google", kind: "search", ai: false, sources: ["googlebot"] },
  { token: "Googlebot-Video", name: "Googlebot-Video", vendor: "Google", kind: "search", ai: false, sources: ["googlebot"] },
  { token: "Googlebot-News", name: "Googlebot-News", vendor: "Google", kind: "search", ai: false, sources: ["googlebot"] },
  { token: "Storebot-Google", name: "Storebot-Google", vendor: "Google", kind: "search", ai: false, sources: ["google-special"] },
  { token: "GoogleOther", name: "GoogleOther", vendor: "Google", kind: "other", ai: false, sources: ["google-special"] },
  { token: "Googlebot", name: "Googlebot", vendor: "Google", kind: "search", ai: false, sources: ["googlebot"] },

  // --- Microsoft ---
  { token: "BingPreview", name: "BingPreview", vendor: "Microsoft", kind: "search", ai: false, sources: ["bingbot"] },
  { token: "bingbot", name: "Bingbot", vendor: "Microsoft", kind: "search", ai: false, sources: ["bingbot"] },

  // --- Apple ---
  { token: "Applebot", name: "Applebot", vendor: "Apple", kind: "search", ai: false, sources: ["applebot"] },

  // --- DuckDuckGo ---
  { token: "DuckAssistBot", name: "DuckAssistBot", vendor: "DuckDuckGo", kind: "training", ai: true, sources: ["duckassistbot"] },

  // --- Meta / ByteDance / Amazon (no published ranges) ---
  { token: "meta-externalagent", name: "meta-externalagent", vendor: "Meta", kind: "training", ai: true },
  { token: "FacebookBot", name: "FacebookBot", vendor: "Meta", kind: "training", ai: true },
  { token: "Bytespider", name: "Bytespider", vendor: "ByteDance", kind: "training", ai: true },
  { token: "Amazonbot", name: "Amazonbot", vendor: "Amazon", kind: "training", ai: true },

  // --- Others (no published ranges) ---
  { token: "MistralAI-User", name: "MistralAI-User", vendor: "Mistral", kind: "on-demand", ai: true },
  { token: "CCBot", name: "CCBot", vendor: "Common Crawl", kind: "training", ai: true },
  { token: "cohere-ai", name: "cohere-ai", vendor: "Cohere", kind: "training", ai: true },
  { token: "Ai2Bot", name: "Ai2Bot", vendor: "Allen Institute", kind: "training", ai: true },
  { token: "YouBot", name: "YouBot", vendor: "You.com", kind: "training", ai: true },
  { token: "Diffbot", name: "Diffbot", vendor: "Diffbot", kind: "training", ai: true },
  { token: "Timpibot", name: "Timpibot", vendor: "Timpi", kind: "training", ai: true },
  { token: "ImagesiftBot", name: "ImagesiftBot", vendor: "ImageSift", kind: "training", ai: true },

  // --- Uptime monitoring ---
  // Named explicitly because these hit constantly and otherwise dominate the
  // log as "Generic Bot", burying the crawlers the experiment is about.
  { token: "Better Uptime Bot", name: "Better Uptime", vendor: "Better Stack", kind: "monitor", ai: false },
  { token: "UptimeRobot", name: "UptimeRobot", vendor: "Uptime Robot", kind: "monitor", ai: false },
  { token: "Pingdom", name: "Pingdom", vendor: "Pingdom", kind: "monitor", ai: false },

  // --- Headless / tooling (renders JS; useful control group) ---
  { token: "HeadlessChrome", name: "HeadlessChrome", vendor: "Chromium", kind: "other", ai: false },
  { token: "Chrome-Lighthouse", name: "Lighthouse", vendor: "Google", kind: "other", ai: false },
];

export type BotMatch = {
  name: string;
  vendor: string;
  kind: BotKind;
  ai: boolean;
  sources?: string[];
};

/** Identify a bot from its User-Agent, or null when it looks like a browser. */
export function identifyBot(userAgent: string): BotMatch | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();

  for (const sig of BOT_SIGNATURES) {
    if (ua.includes(sig.token.toLowerCase())) {
      return {
        name: sig.name,
        vendor: sig.vendor,
        kind: sig.kind,
        ai: sig.ai,
        sources: sig.sources,
      };
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
