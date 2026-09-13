import Link from "next/link";
import { categories, formatDate, type Post } from "@/lib/posts";

export default function PostList({ posts, headingLevel = 3 }: { posts: Post[]; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <ul className="border-t border-line">
      {posts.map((post) => (
        <li key={post.slug} className="border-b border-line">
          <Link
            href={`/blog/${post.slug}`}
            className="group grid gap-1.5 py-5 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-8"
          >
            <div>
              <Heading className="text-[17px] font-medium tracking-[-0.01em] text-pretty transition-colors duration-300 group-hover:text-accent">
                {post.title}
              </Heading>
              <p className="mt-1 text-[15px] leading-relaxed text-pretty text-muted">{post.description}</p>
            </div>
            <p className="order-first font-mono text-xs text-muted sm:order-none sm:whitespace-nowrap">
              <time dateTime={post.date}>{formatDate(post.date, "short")}</time> · {categories[post.category]}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
