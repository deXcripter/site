import type { MetadataRoute } from "next";
import { gallery } from "@/content/gallery";
import { getAllPosts } from "@/lib/posts";
import { site } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const latest = posts[0]?.date;

  return [
    { url: site.url, lastModified: latest, changeFrequency: "weekly", priority: 1 },
    { url: `${site.url}/blog`, lastModified: latest, changeFrequency: "weekly", priority: 0.9 },
    ...posts.map((post) => ({
      url: `${site.url}/blog/${post.slug}`,
      lastModified: post.updated ?? post.date,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: `${site.url}/experience`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site.url}/about`, changeFrequency: "monthly", priority: 0.7 },
    ...(gallery.length
      ? [{ url: `${site.url}/gallery`, changeFrequency: "weekly" as const, priority: 0.5, images: gallery.map((p) => p.src) }]
      : []),
  ];
}
