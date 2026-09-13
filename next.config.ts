import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**.r2.dev" }],
  },
  async redirects() {
    return [
      { source: "/chronicle", destination: "/experience", permanent: true },
      { source: "/essays", destination: "/blog", permanent: true },
      { source: "/essays/:slug", destination: "/blog/:slug", permanent: true },
      { source: "/sitemaps.xml", destination: "/sitemap.xml", permanent: true },
    ];
  },
};

// Turbopack needs plugins referenced by name with serializable options.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: { light: "github-light", dark: "github-dark-dimmed" }, keepBackground: false }],
    ],
  },
});

export default withMDX(nextConfig);
