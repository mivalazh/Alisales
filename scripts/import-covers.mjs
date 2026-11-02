#!/usr/bin/env node
/**
 * Imports real car photos into the catalogue art folder.
 *
 * Drop the originals in `artifacts/photo-uploads/` named 1, 2, 3, 4 (any of
 * .jpg/.jpeg/.png/.webp/.heic handled by sharp). Each photo becomes two WebP
 * assets under `apps/web/public/covers/photos/`:
 *
 *   <name>.webp        1600px wide — detail gallery / story viewer
 *   <name>-thumb.webp   480px wide — grid cards, row thumbs, story rings
 *
 * Run: node scripts/import-covers.mjs
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPLOADS = path.join(ROOT, 'artifacts/photo-uploads');
const OUT = path.join(ROOT, 'apps/web/public/covers/photos');

/** Position → output name, matching the listing each photo belongs to. */
const TARGETS = {
  1: { name: 'land-cruiser-vxr', listing: 'land-cruiser-kish' },
  2: { name: 'lexus-sedan', listing: 'lexus-rx-kish' },
  3: { name: 'mercedes-s500', listing: 's-class-kish' },
  4: { name: 'porsche-coupe', listing: 'cayenne-kish' },
};

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff']);
const PUBLIC_PREFIX = '/covers/photos';

async function main() {
  let entries;
  try {
    entries = await readdir(UPLOADS);
  } catch {
    console.error(`No upload folder yet: ${path.relative(ROOT, UPLOADS)}`);
    console.error('Save the photos there as 1.jpg, 2.jpg, 3.jpg, 4.jpg and rerun.');
    process.exit(1);
  }

  const sources = entries
    .filter((file) => EXT.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  if (sources.length === 0) {
    console.error(`No images found in ${path.relative(ROOT, UPLOADS)}`);
    process.exit(1);
  }

  await mkdir(OUT, { recursive: true });
  const wiring = [];

  for (const file of sources) {
    const index = Number.parseInt(file, 10);
    const target = TARGETS[index];
    if (!target) {
      console.warn(`skip ${file} — expected a leading 1-${Object.keys(TARGETS).length}`);
      continue;
    }
    const input = path.join(UPLOADS, file);
    const full = path.join(OUT, `${target.name}.webp`);
    const thumb = path.join(OUT, `${target.name}-thumb.webp`);
    const image = sharp(input).rotate();

    await image.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(full);
    await image.clone().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 80 }).toFile(thumb);

    const meta = await sharp(full).metadata();
    const size = (await stat(full)).size;
    console.log(
      `${file} → ${path.relative(ROOT, full)} (${meta.width}×${meta.height}, ${Math.round(size / 1024)} KB)`,
    );
    wiring.push({
      listing: target.listing,
      coverUrl: `${PUBLIC_PREFIX}/${target.name}-thumb.webp`,
      photos: [`${PUBLIC_PREFIX}/${target.name}.webp`],
    });
  }

  console.log('\nFixture wiring:');
  console.log(JSON.stringify(wiring, null, 2));
}

main().catch((error) => {
  console.error('Import failed:', error.message);
  process.exit(1);
});
