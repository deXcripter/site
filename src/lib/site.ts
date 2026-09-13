import type { Metadata } from "next";

export const site = {
  name: "Johnpaul Nnaji",
  givenName: "Johnpaul",
  familyName: "Nnaji",
  handle: "dexcripter",
  // Drop a square photo in /public and set this to its path (e.g. "/avatar.jpg") to replace the logo avatar.
  avatar: null as string | null,
  twitter: "@dexcripter",
  url: "https://www.dexcripter.me",
  locale: "en_US",
  title: "Johnpaul Nnaji | Software Engineer & SEO Builder",
  description:
    "Software engineer building SEORCE, and writing honest notes on SEO, crawlers, and how pages get into AI answers.",
  socials: [
    { label: "GitHub", href: "https://github.com/dexcripter" },
    { label: "X", href: "https://x.com/dexcripter" },
    { label: "LinkedIn", href: "https://linkedin.com/in/dexcripter" },
  ],
  knowsAbout: [
    "Search Engine Optimization",
    "Technical SEO",
    "Generative Engine Optimization",
    "Artificial Intelligence",
    "Software Engineering",
  ],
} as const;

export const personId = `${site.url}/#person`;

type MetaInput = {
  title?: string;
  description: string;
  path: string;
  article?: { publishedTime: string; modifiedTime: string; tags: string[] };
};

// Next merges `openGraph`/`twitter` shallowly, so every page gets the full object.
export function pageMeta({ title, description, path, article }: MetaInput): Metadata {
  const ogTitle = title ?? site.title;
  const base = { url: path, siteName: site.name, locale: site.locale, title: ogTitle, description };

  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: path },
    openGraph: article
      ? {
          ...base,
          type: "article",
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
          authors: [`${site.url}/about`],
          tags: article.tags,
        }
      : { ...base, type: "website" },
    twitter: { card: "summary_large_image", creator: site.twitter, title: ogTitle, description },
  };
}
