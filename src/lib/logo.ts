export const LOGO_LEFT_CLIP = "M0 0H18.6L10 17.6L20.4 15.2L11.6 32H0Z";
export const LOGO_RIGHT_CLIP = "M18.6 0H32V32H11.6L20.4 15.2L10 17.6Z";

export const logoColors = {
  light: { base: "#161616", jump: "#0b7468" },
  dark: { base: "#f2f1ed", jump: "#45d3c0" },
} as const;

// Standalone SVG markup for raster contexts (OG images, apple icon) where React components can't render.
export function logoSvg({ base, jump }: { base: string; jump: string }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><clipPath id="l"><path d="${LOGO_LEFT_CLIP}"/></clipPath><clipPath id="r"><path d="${LOGO_RIGHT_CLIP}"/></clipPath></defs><rect x="1.5" y="3.5" width="27" height="27" rx="7" fill="${base}" clip-path="url(#l)"/><g transform="translate(1.8 -1.8)"><rect x="1.5" y="3.5" width="27" height="27" rx="7" fill="${jump}" clip-path="url(#r)"/></g></svg>`;
}

export const logoDataUri = (colors: { base: string; jump: string }) =>
  `data:image/svg+xml,${encodeURIComponent(logoSvg(colors))}`;
