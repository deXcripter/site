export type LabTool = {
  slug: string;
  href: string;
  title: string;
  tagline: string;
  description: string;
  badge: string;
  status: string;
  highlights: string[];
};

export const labTools: LabTool[] = [
  {
    slug: "ai-visibility",
    href: "/lab/ai-visibility",
    title: "AI Crawler Visibility Checker",
    tagline: "Can AI crawlers see your website?",
    description:
      "Test any URL against GPTBot, ClaudeBot, PerplexityBot, and others. Analyzes robots.txt rules, firewall & CDN blocks, noindex headers, and JavaScript dependency.",
    badge: "Interactive Tool",
    status: "Live",
    highlights: [
      "robots.txt rule evaluator",
      "Firewall & CDN detection",
      "JS dependency check",
      "Simulated crawler view",
    ],
  },
  {
    slug: "ai-crawler",
    href: "/lab/ai-crawler",
    title: "AI Crawler Rendering Test",
    tagline: "Which AI crawlers actually execute JavaScript?",
    description:
      "A live honeypot page and edge log measuring which AI search bots and LLM scrapers execute client-side JavaScript vs. only reading raw HTML.",
    badge: "Live Benchmark",
    status: "Public Logs",
    highlights: [
      "Edge request vs JS callback",
      "IP range verification",
      "Zero personal data logged",
      "Public real-time logs",
    ],
  },
];
