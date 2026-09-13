# dexcripter.me

The personal site of Johnpaul Nnaji: a software engineer building SEORCE and writing about SEO, crawlers, and how pages get into AI answers.

Live at **[www.dexcripter.me](https://www.dexcripter.me)**.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack), every page statically generated
- [MDX](https://mdxjs.com) posts with [Shiki](https://shiki.style) syntax highlighting via `rehype-pretty-code`
- [Tailwind CSS 4](https://tailwindcss.com), DM Sans and DM Mono
- Hosted on Vercel, media on Cloudflare R2

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (also type-checks)
npm run lint
```

No environment variables are required.

## Project structure

```
src/
├── app/                  # routes
│   ├── page.tsx          # home
│   ├── blog/             # index, [slug] posts, per-post OG images
│   ├── experience/  about/  gallery/
│   ├── sitemap.ts  robots.ts  feed.xml/   # generated from content
│   ├── icon.svg  apple-icon.tsx  opengraph-image.tsx
│   └── layout.tsx        # fonts, theme script, Person/WebSite JSON-LD
├── content/
│   ├── blog/*.mdx        # blog posts
│   ├── experience.ts     # work, education, selected projects
│   └── gallery.ts        # gallery photos
├── components/           # dock, footer, logo, post list, theme toggle…
├── lib/
│   ├── site.ts           # name, URL, socials, shared metadata helper
│   ├── posts.ts          # reads and sorts MDX posts
│   └── logo.ts           # the Rank Jump mark (single source of truth)
└── mdx-components.tsx    # how MDX links and images render
public/blog/<slug>/       # images used inside posts
```

## Writing a post

1. Create `src/content/blog/<slug>.mdx`. The filename is the URL (`/blog/<slug>`), so don't rename it after publishing.
2. Start with frontmatter:

   ```mdx
   ---
   title: "How Google Decides What to Crawl"
   description: "Summary for search results and share cards, under 160 characters."
   date: "2026-09-20"
   category: "search-ai"        # "search-ai" or "personal"
   tags: ["crawling", "technical-seo"]
   ---
   ```

   Add `updated: "YYYY-MM-DD"` when you revise a post.
3. Write in Markdown. Use `##` and `###` headings (the title is already the `h1`). Three or more `##` sections add an "On this page" menu.
4. Put images in `public/blog/<slug>/` and reference them as `![alt text](/blog/<slug>/image.png)`. A line of `_italic text_` right below an image becomes its caption.
5. In prose, escape `{`, `}` and `<` as `\{`, `\}`, `\<`. Code blocks don't need escaping.
6. Preview with `npm run dev`, then commit and push. Vercel rebuilds, and the post appears on the blog, the home page, the sitemap and the RSS feed.

## Adding gallery photos

Upload photos to the R2 bucket, then add entries to `src/content/gallery.ts`:

```ts
{ src: "https://pub-xxxx.r2.dev/gallery/photo.jpg", alt: "What's in the photo", width: 3024, height: 4032, date: "2026-08-14", caption: "Optional" }
```

`width` and `height` must be the image's real pixel size. Photos from a new domain need that hostname added to `images.remotePatterns` in `next.config.ts`. While the gallery is empty, the page is `noindex` and left out of the sitemap.

## SEO

- Static HTML for every route, so crawlers never depend on JavaScript
- Per-page titles, descriptions and canonical URLs through `pageMeta()` in `src/lib/site.ts`
- JSON-LD: `Person` and `WebSite` site-wide, `BlogPosting` and `BreadcrumbList` on posts, `ProfilePage` on about
- Generated `sitemap.xml`, `robots.txt`, `feed.xml` and Open Graph images for the site and each post
- Permanent redirects for old URLs: `/chronicle` → `/experience`, `/essays/*` → `/blog/*`

## Brand

The logo is the Rank Jump mark, defined once in `src/lib/logo.ts` and rendered by `src/components/logo.tsx`.

| Token | Light | Dark |
|---|---|---|
| Background | `#edece8` | `#0a0a0a` |
| Text | `#161616` | `#f2f1ed` |
| Accent | `#0b7468` | `#45d3c0` |
