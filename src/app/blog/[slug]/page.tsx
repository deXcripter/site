import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import JsonLd from "@/components/json-ld";
import Logo from "@/components/logo";
import PostList from "@/components/post-list";
import { stagger } from "@/lib/motion";
import { categories, formatDate, getAllPosts, getHeadings, getPost } from "@/lib/posts";
import { pageMeta, personId, site } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return pageMeta({
    title: post.title,
    description: post.description,
    path: `/blog/${post.slug}`,
    article: { publishedTime: post.date, modifiedTime: post.updated ?? post.date, tags: post.tags },
  });
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { default: Content } = await import(`@/content/blog/${slug}.mdx`);
  const outline = getHeadings(slug).filter((h) => h.level === 2);
  const others = getAllPosts().filter((p) => p.slug !== slug);
  const related = [...others.filter((p) => p.category === post.category), ...others.filter((p) => p.category !== post.category)].slice(0, 2);
  const url = `${site.url}/blog/${slug}`;

  return (
    <>
      <article className="mx-auto max-w-2xl pt-24 sm:pt-32">
        <nav aria-label="Breadcrumb" className="rise font-mono text-xs text-muted">
          <ol className="flex gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-fg">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/blog" className="transition-colors hover:text-fg">
                Blog
              </Link>
            </li>
          </ol>
        </nav>

        <header className="rise mt-8" style={stagger(1)}>
          <h1 className="text-[2.35rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg text-pretty text-muted">{post.description}</p>
          <p className="mt-6 flex flex-wrap gap-x-2.5 font-mono text-xs text-muted">
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{post.readingMinutes} min read</span>
            <span aria-hidden>·</span>
            <span>{categories[post.category]}</span>
          </p>
        </header>

        {outline.length >= 3 && (
          <details className="rise group mt-10 rounded-2xl border border-line px-5 py-4" style={stagger(2)}>
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
              On this page
              <span aria-hidden className="text-muted transition-transform duration-300 group-open:rotate-45">
                +
              </span>
            </summary>
            <ol className="mt-3 space-y-2 text-sm text-muted">
              {outline.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="transition-colors hover:text-fg">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="prose rise mt-12" style={stagger(3)}>
          <Content />
        </div>

        <footer className="mt-16 flex items-center gap-4 border-t border-line pt-8">
          <Logo className="size-10 shrink-0 text-fg" />
          <p className="text-sm text-muted">
            Written by{" "}
            <Link href="/about" rel="author" className="font-medium text-fg hover:text-accent">
              {site.name}
            </Link>
            {/* , a software engineer building SEORCE. */}
          </p>
        </footer>
      </article>

      {related.length > 0 && (
        <section aria-labelledby="more" className="mx-auto mt-20 max-w-2xl">
          <h2 id="more" className="mb-3 font-mono text-xs tracking-[0.14em] text-muted uppercase">
            Keep reading
          </h2>
          <PostList posts={related} />
        </section>
      )}

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BlogPosting",
              "@id": `${url}#article`,
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              dateModified: post.updated ?? post.date,
              url,
              mainEntityOfPage: url,
              inLanguage: "en",
              articleSection: categories[post.category],
              keywords: post.tags.join(", "),
              author: { "@type": "Person", "@id": personId, name: site.name, url: `${site.url}/about` },
              publisher: { "@id": personId },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: site.url },
                { "@type": "ListItem", position: 2, name: "Blog", item: `${site.url}/blog` },
                { "@type": "ListItem", position: 3, name: post.title, item: url },
              ],
            },
          ],
        }}
      />
    </>
  );
}
