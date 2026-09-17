import Image from "next/image";
import Link from "next/link";
import Logo from "@/components/logo";
import { categories, formatDate, type Post } from "@/lib/posts";

export default function PostList({ posts, headingLevel = 3 }: { posts: Post[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <ul className="border-t border-line">
      {posts.map((post) => (
        <li key={post.slug} className="border-b border-line">
          <Link href={`/blog/${post.slug}`} className="group flex items-start gap-4 py-5">
            <span className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-line bg-bg sm:h-24 sm:w-36">
              {post.cover ? (
                <Image
                  src={post.cover}
                  // Decorative: the title beside it already names the post.
                  alt=""
                  fill
                  sizes="(min-width: 640px) 144px, 112px"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <Logo className="absolute inset-0 m-auto size-6 text-muted" />
              )}
            </span>
            <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8">
              <div>
                <Heading className="text-[17px] font-medium tracking-[-0.01em] text-pretty transition-colors duration-300 group-hover:text-accent">
                  {post.title}
                </Heading>
                <p className="mt-1 text-[15px] leading-relaxed text-pretty text-muted">{post.description}</p>
              </div>
              <p className="order-first font-mono text-xs text-muted sm:order-none sm:whitespace-nowrap">
                <time dateTime={post.date}>{formatDate(post.date, "short")}</time> · {categories[post.category]}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
