"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { GalleryItem } from "@/content/gallery";

type GalleryLightboxProps = {
  photos: GalleryItem[];
};

export default function GalleryLightbox({ photos }: GalleryLightboxProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryItem | null>(null);

  useEffect(() => {
    if (!selectedPhoto) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPhoto(null);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [selectedPhoto]);

  return (
    <>
      <ul className="rise mt-14 columns-1 gap-3 sm:columns-2 lg:columns-3" style={{ "--i": 1 } as React.CSSProperties}>
        {photos.map((photo, index) => (
          <li key={photo.src} className="mb-3 break-inside-avoid">
            <figure>
              <button
                type="button"
                onClick={() => setSelectedPhoto(photo)}
                className="group block w-full cursor-zoom-in text-left"
                aria-label={`Expand photo: ${photo.alt}`}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  loading={index < 3 ? "eager" : "lazy"}
                  className="h-auto w-full rounded-xl border border-line transition duration-300 group-hover:brightness-90"
                />
              </button>
              {photo.caption && <figcaption className="mt-2 font-mono text-xs text-muted">{photo.caption}</figcaption>}
            </figure>
          </li>
        ))}
      </ul>

      {selectedPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedPhoto.alt}
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 sm:p-8"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedPhoto(null)}
            aria-label="Close expanded photo"
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-white/10 text-2xl leading-none text-white transition hover:bg-white/20"
          >
            <span aria-hidden>×</span>
          </button>
          <div className="relative max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
            <Image
              src={selectedPhoto.src}
              alt={selectedPhoto.alt}
              width={selectedPhoto.width}
              height={selectedPhoto.height}
              sizes="calc(100vw - 2rem)"
              className="max-h-[calc(100vh-4rem)] w-auto rounded-lg object-contain"
            />
            {selectedPhoto.caption && <p className="mt-3 text-center font-mono text-xs text-white/75">{selectedPhoto.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}