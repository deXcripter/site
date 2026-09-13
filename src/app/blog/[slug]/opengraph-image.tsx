import { ImageResponse } from "next/og";
import { logoColors, logoDataUri } from "@/lib/logo";
import { categories, formatDate, getAllPosts, getPost } from "@/lib/posts";
import { site } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Article cover";

export function generateStaticParams() {
  return getAllPosts().map(({ slug }) => ({ slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#edece8",
          color: "#161616",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 26, color: "#64625e" }}>
          <img src={logoDataUri(logoColors.light)} width={44} height={44} alt="" />
          {site.name} · {post ? categories[post.category] : "Blog"}
        </div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.06, maxWidth: 1020 }}>
          {post?.title ?? site.name}
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#64625e" }}>
          {post ? `${formatDate(post.date)} · ` : ""}dexcripter.me
        </div>
      </div>
    ),
    size,
  );
}
