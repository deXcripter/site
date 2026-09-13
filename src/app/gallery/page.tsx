import type { Metadata } from "next";
import Image from "next/image";
import { gallery } from "@/content/gallery";
import { stagger } from "@/lib/motion";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMeta({
    title: "Gallery",
    description: "Snapshots from events, work, and everyday life.",
    path: "/gallery",
  }),
  // An empty page is thin content; keep it out of the index until photos land.
  ...(gallery.length === 0 ? { robots: { index: false, follow: true } } : {}),
};

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-5xl pt-24 sm:pt-32">
      <header className="rise mx-auto max-w-2xl">
        <p className="font-mono text-xs tracking-[0.14em] text-muted uppercase">Gallery</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Snapshots.</h1>
        <p className="mt-4 max-w-lg text-lg text-pretty text-muted">Events, work, and the in-between.</p>
      </header>

      {gallery.length === 0 ? (
        <div className="rise mx-auto mt-14 max-w-2xl rounded-2xl border border-dashed border-line px-6 py-16 text-center" style={stagger(1)}>
          <p className="font-medium">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted">Photos are on their way.</p>
        </div>
      ) : (
        <ul className="rise mt-14 columns-1 gap-3 sm:columns-2 lg:columns-3" style={stagger(1)}>
          {gallery.map((photo, index) => (
            <li key={photo.src} className="mb-3 break-inside-avoid">
              <figure>
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading={index < 3 ? "eager" : "lazy"}
                  className="h-auto w-full rounded-xl border border-line"
                />
                {photo.caption && <figcaption className="mt-2 font-mono text-xs text-muted">{photo.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
