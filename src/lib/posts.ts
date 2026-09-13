import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

export const categories = {
  "search-ai": "Search & AI",
  personal: "Personal",
} as const;

export type Category = keyof typeof categories;

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated?: string;
  category: Category;
  tags: string[];
  readingMinutes: number;
};

export type Heading = { id: string; text: string; level: 2 | 3 };

const POSTS_DIR = path.join(process.cwd(), "src/content/blog");

const readSource = cache((slug: string) =>
  matter(fs.readFileSync(path.join(POSTS_DIR, `${slug}.mdx`), "utf8")),
);

export const getAllPosts = cache((): Post[] =>
  fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const slug = file.replace(/\.mdx$/, "");
      const { data, content } = readSource(slug);
      const words = content.split(/\s+/).filter(Boolean).length;
      return {
        slug,
        title: data.title,
        description: data.description,
        date: data.date,
        updated: data.updated,
        category: data.category,
        tags: data.tags ?? [],
        readingMinutes: Math.max(1, Math.round(words / 230)),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date)),
);

export function getPost(slug: string) {
  return getAllPosts().find((post) => post.slug === slug);
}

// Mirrors rehype-slug so outline links match the rendered heading ids.
export function getHeadings(slug: string): Heading[] {
  const slugger = new GithubSlugger();
  const body = readSource(slug).content.replace(/```[\s\S]*?```/g, "");
  return [...body.matchAll(/^(#{2,3})\s+(.+)$/gm)].map(([, hashes, raw]) => {
    const text = raw
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();
    return { id: slugger.slug(text), text, level: hashes.length as 2 | 3 };
  });
}

export function formatDate(date: string, month: "short" | "long" = "long") {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month,
    day: "numeric",
    timeZone: "UTC",
  });
}
