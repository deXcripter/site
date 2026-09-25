/**
 * The crawlers the visibility checker reports on.
 *
 * Kept separate from `bots.ts`, which identifies incoming requests. This list
 * is about robots.txt tokens, including two (`Google-Extended`,
 * `Applebot-Extended`) that are never sent as a User-Agent and exist only to
 * be named in robots.txt.
 *
 * The kind matters for how a block is judged. Blocking a training crawler is
 * a legitimate choice that does not keep a site out of AI answers; blocking a
 * search or user-triggered fetcher does.
 */

export type CrawlerKind = "training" | "search" | "on-demand";

export type Crawler = {
  token: string;
  vendor: string;
  kind: CrawlerKind;
  purpose: string;
  /** A real User-Agent string, for the live firewall test. Absent for opt-out-only tokens. */
  userAgent?: string;
  /** robots.txt-only token: never fetches anything under this name. */
  tokenOnly?: boolean;
};

export const CRAWLERS: Crawler[] = [
  {
    token: "OAI-SearchBot",
    vendor: "OpenAI",
    kind: "search",
    purpose: "Indexes pages that ChatGPT search can cite.",
  },
  {
    token: "ChatGPT-User",
    vendor: "OpenAI",
    kind: "on-demand",
    purpose: "Fetches a page when a ChatGPT user asks about it.",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
  },
  {
    token: "GPTBot",
    vendor: "OpenAI",
    kind: "training",
    purpose: "Collects training data for OpenAI models.",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.3; +https://openai.com/gptbot)",
  },
  {
    token: "Claude-SearchBot",
    vendor: "Anthropic",
    kind: "search",
    purpose: "Indexes pages that Claude can cite in search answers.",
  },
  {
    token: "Claude-User",
    vendor: "Anthropic",
    kind: "on-demand",
    purpose: "Fetches a page when a Claude user asks about it.",
  },
  {
    token: "ClaudeBot",
    vendor: "Anthropic",
    kind: "training",
    purpose: "Collects training data for Anthropic models.",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
  },
  {
    token: "PerplexityBot",
    vendor: "Perplexity",
    kind: "search",
    purpose: "Indexes pages that Perplexity cites in answers.",
    userAgent:
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
  },
  {
    token: "Perplexity-User",
    vendor: "Perplexity",
    kind: "on-demand",
    purpose: "Fetches a page when a Perplexity user asks about it.",
  },
  {
    token: "Googlebot",
    vendor: "Google",
    kind: "search",
    purpose: "Google Search, which also feeds AI Overviews and AI Mode.",
  },
  {
    token: "Google-Extended",
    vendor: "Google",
    kind: "training",
    purpose: "Opt-out token for Gemini training. Does not affect Search.",
    tokenOnly: true,
  },
  {
    token: "Bingbot",
    vendor: "Microsoft",
    kind: "search",
    purpose: "Bing's index, which grounds Microsoft Copilot answers.",
  },
  {
    token: "Applebot-Extended",
    vendor: "Apple",
    kind: "training",
    purpose: "Opt-out token for Apple Intelligence training.",
    tokenOnly: true,
  },
  {
    token: "DuckAssistBot",
    vendor: "DuckDuckGo",
    kind: "search",
    purpose: "Fetches sources for DuckDuckGo's AI answers.",
  },
  {
    token: "MistralAI-User",
    vendor: "Mistral",
    kind: "on-demand",
    purpose: "Fetches a page when a Le Chat user asks about it.",
  },
  {
    token: "meta-externalagent",
    vendor: "Meta",
    kind: "training",
    purpose: "Collects training data for Meta's AI models.",
  },
  {
    token: "Amazonbot",
    vendor: "Amazon",
    kind: "training",
    purpose: "Crawls for Amazon's AI products, including Alexa.",
  },
  {
    token: "CCBot",
    vendor: "Common Crawl",
    kind: "training",
    purpose: "Open web archive that many language models train on.",
  },
  {
    token: "Bytespider",
    vendor: "ByteDance",
    kind: "training",
    purpose: "Collects training data for ByteDance models.",
  },
];

export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
