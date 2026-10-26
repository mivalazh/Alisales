/**
 * Generates the mobile app icon set from the shared Alisales SVG mark
 * (packages/design/logo/logo-symbol.svg geometry — keep in sync).
 *
 * Usage: npm run generate:icons
 * Outputs into apps/mobile/assets/images/ (paths referenced by app.json).
 */
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'apps', 'mobile', 'assets', 'images');

const glyph = (strokeA, strokeBar) => `
  <g fill="none" stroke="${strokeA}" stroke-width="46" stroke-linecap="round" stroke-linejoin="round">
    <path d="M136 372 L256 128 L376 372"/>
  </g>
  <path d="M188 284 H324" fill="none" stroke="${strokeBar}" stroke-width="46" stroke-linecap="round"/>`;

const tile = `<rect width="512" height="512" rx="112" fill="#161224"/>${glyph('#FFFFFF', '#FF4000')}`;

const svg = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${inner}</svg>`;

/** Glyph centered on a transparent 1024 canvas at 66% (Android adaptive safe zone). */
async function adaptiveGlyph(outer, bar) {
  const size = 676; // 1024 × 0.66
  const pad = 174; // (1024 − 676) / 2
  const glyphPng = await sharp(Buffer.from(svg(glyph(outer, bar))))
    .resize(size, size)
    .png()
    .toBuffer();
  return sharp(glyphPng)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  await mkdir(out, { recursive: true });

  // Full rounded-tile mark (app icon + favicon)
  await sharp(Buffer.from(svg(tile))).resize(1024, 1024).png().toFile(join(out, 'icon.png'));
  await sharp(Buffer.from(svg(tile))).resize(64, 64).png().toFile(join(out, 'favicon.png'));

  // Android adaptive layers: navy background comes from app.json backgroundColor
  await sharp(await adaptiveGlyph('#FFFFFF', '#FF4000'))
    .toFile(join(out, 'android-icon-foreground.png'));
  await sharp(await adaptiveGlyph('#FFFFFF', '#FFFFFF'))
    .toFile(join(out, 'android-icon-monochrome.png'));

  // Splash: white A with the orange accent on the navy splash background
  await sharp(Buffer.from(svg(glyph('#FFFFFF', '#FF4000'))))
    .resize(512, 512)
    .png()
    .toFile(join(out, 'splash-icon.png'));

  console.log('icons written to', out);
}

main();
