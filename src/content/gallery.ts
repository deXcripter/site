export type GalleryItem = {
  src: string;
  alt: string;
  width: number;
  height: number;
  date: string;
  caption?: string;
};

// Host images on Cloudflare R2 and add the bucket's domain to images.remotePatterns in next.config.ts.
export const gallery: GalleryItem[] = [];
