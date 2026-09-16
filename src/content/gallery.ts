export type GalleryItem = {
  src: string;
  alt: string;
  width: number;
  height: number;
  date: string;
  caption?: string;
};

// Host images on Cloudflare R2 and add the bucket's domain to images.remotePatterns in next.config.ts.
export const gallery: GalleryItem[] = [
  {
    src: "https://images.dexcripter.me/uploads/1783323291147-caca612ec91790ab-50-_MG_2011.jpg",
    caption: "Speaking about improving productivity with AI",
    width: 3024,
    height: 4032,
    date: "2026-03-15",
    alt: "Johnpaul speaking at an event",
  },
  {
    src: "https://images.dexcripter.me/uploads/1783330442562-0c193ef872c0c9f0-IMG_20241102_110638.jpg",
    alt: "Johnpaul at a crypto event",
    width: 1536,
    height: 2048,
    date: "2024-11-01",
    caption: "At a Web3 crypto event",
  },
  {
    src: "https://images.dexcripter.me/uploads/1784059518406-d0b47157c7420a9b-IMG_20240322_152700-jpg.jpeg",
    alt: "Johnpaul at a university",
    width: 2048,
    height: 1542,
    date: "2024-02-01",
    caption: "At the university",
  },
];
