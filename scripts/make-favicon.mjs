/**
 * Regenerates src/app/favicon.ico from src/app/icon.svg.
 *
 * icon.svg covers modern browsers, which prefer the SVG and get its dark-mode
 * variant. favicon.ico exists for everything that only ever asks for
 * /favicon.ico -- Google's favicon crawler, feed readers, Slack unfurls.
 * Those rasterize once, so this bakes in the light-mode colors.
 *
 * Run after editing icon.svg:  node scripts/make-favicon.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SIZES = [16, 32, 48];
const svg = readFileSync(new URL("../src/app/icon.svg", import.meta.url));

const pngs = await Promise.all(
  // Rasterize from a high density so the clip-path edges stay clean at 16px.
  SIZES.map((size) => sharp(svg, { density: 512 }).resize(size, size).png().toBuffer()),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(SIZES.length, 4);

let offset = 6 + SIZES.length * 16;
const entries = pngs.map((png, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(SIZES[i], 0); // width
  entry.writeUInt8(SIZES[i], 1); // height
  entry.writeUInt8(0, 2); // palette size: 0 for truecolor
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  return entry;
});

const out = new URL("../src/app/favicon.ico", import.meta.url);
writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]));
console.log(`wrote favicon.ico (${SIZES.join(", ")}px)`);
