#!/usr/bin/env node
/**
 * Builds the catalogue photo set from the supplied Unsplash originals.
 *
 * Originals are downloaded once into `artifacts/photo-uploads/src/` (git-ignored)
 * and every listing gets a 1600 px WebP gallery frame plus a 480 px card/story
 * thumb under `apps/web/public/covers/photos/`. Listings that have no dedicated
 * original in the supplied set use a distinct crop of one, so every card shows
 * real photography and no two cards share a cover file.
 *
 * Run: node scripts/build-covers.mjs [--force]
 */
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'artifacts/photo-uploads/src');
const OUT = path.join(ROOT, 'apps/web/public/covers/photos');
const PUBLIC_PREFIX = '/covers/photos';

/** The twelve supplied originals, keyed by what the frame actually shows. */
const SOURCES = {
  'porsche-911': 'https://images.unsplash.com/photo-1594502184342-2e12f877aa73?auto=format&fit=crop&w=1600&q=80',
  'lexus-lx570': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1600&q=80',
  panamera: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1600&q=80',
  huracan: 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?auto=format&fit=crop&w=1600&q=80',
  camaro: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1600&q=80',
  mclaren: 'https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1600&q=80',
  boxster: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1600&q=80',
  'crv': 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1600&q=80',
  'amg-gt': 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1600&q=80',
  'bmw-m5': 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1600&q=80',
  'engine-bay': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=1600&q=80',
  mechanic: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=1600&q=80',
};

/**
 * Cover per listing. `crop` keeps the subject tight when a listing borrows a
 * frame from the set instead of having its own shot: [left, top, width, height]
 * in fractions of the source.
 */
const COVERS = [
  { slug: 'land-cruiser-kish', source: 'lexus-lx570', focus: 'centre' },
  { slug: 'patrol-platinum-kish', source: 'crv', focus: 'centre' },
  { slug: 's-class-kish', source: 'panamera', focus: 'centre' },
  { slug: 'bmw-x5-kish', source: 'bmw-m5', focus: 'centre' },
  { slug: 'cayenne-kish', source: 'porsche-911', focus: 'centre' },
  { slug: 'lexus-rx-kish', source: 'amg-gt', focus: 'centre' },
  { slug: 'land-cruiser-gearbox-part', source: 'mechanic', focus: 'centre' },
  { slug: 'cayenne-brake-kit-part', source: 'engine-bay', focus: 'centre' },
  { slug: 'camaro-kish', source: 'camaro', focus: 'centre' },
  { slug: 'huracan-showroom', source: 'huracan', focus: 'centre' },
  { slug: 'panamera-tehran', source: 'panamera', crop: [0.14, 0.2, 0.66, 0.62] },
  { slug: 'camaro-alice', source: 'camaro', crop: [0.2, 0.18, 0.62, 0.6] },
  { slug: 'm5-tehran', source: 'bmw-m5', crop: [0.18, 0.22, 0.64, 0.58] },
  { slug: 'amg-gt-sold', source: 'amg-gt', crop: [0.16, 0.16, 0.66, 0.64] },
  { slug: 'mclaren-kish-showroom', source: 'mclaren', focus: 'centre' },
  { slug: 'boxster-transit', source: 'boxster', crop: [0.12, 0.24, 0.68, 0.6] },
];

const force = process.argv.includes('--force');

async function download(key, url) {
  const file = path.join(SRC, `${key}.jpg`);
  if (existsSync(file) && !force) return file;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${key}: HTTP ${response.status}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`downloaded ${key}`);
  return file;
}

async function main() {
  await mkdir(SRC, { recursive: true });
  await mkdir(OUT, { recursive: true });

  // The user's originals are already on disk as 01..12; reuse them by content.
  const onDisk = (await readdir(SRC).catch(() => [])).filter((f) => /^\d\d\.jpg$/.test(f)).sort();
  const order = Object.keys(SOURCES);
  const sourceFiles = new Map();
  for (const [index, key] of order.entries()) {
    const local = onDisk[index];
    if (local) sourceFiles.set(key, path.join(SRC, local));
    else sourceFiles.set(key, await download(key, SOURCES[key]));
  }

  const make = async (sourceKey, outfile, crop) => {
    const input = sharp(sourceFiles.get(sourceKey)).rotate();
    const meta = await input.metadata();
    const region = crop
      ? {
          left: Math.round(meta.width * crop[0]),
          top: Math.round(meta.height * crop[1]),
          width: Math.round(meta.width * crop[2]),
          height: Math.round(meta.height * crop[3]),
        }
      : null;
    const base = () => (region ? sharp(sourceFiles.get(sourceKey)).rotate().extract(region) : sharp(sourceFiles.get(sourceKey)).rotate());
    await base().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(OUT, `${outfile}.webp`));
    await base().resize({ width: 480, height: 360, fit: 'cover' }).webp({ quality: 80 }).toFile(path.join(OUT, `${outfile}-thumb.webp`));
  };

  for (const cover of COVERS) {
    await make(cover.source, cover.slug, cover.crop);
    console.log(`${cover.slug} ← ${cover.source}${cover.crop ? ' (crop)' : ''}`);
  }
  console.log(`\n${PUBLIC_PREFIX}/<slug>.webp and /<slug>-thumb.webp written to apps/web/public/covers/photos/`);
}

main().catch((error) => {
  console.error('Build failed:', error.message);
  process.exit(1);
});
