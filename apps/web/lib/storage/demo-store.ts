import { join } from 'node:path';
import { demoDataDir } from '../config/mode';
import { nodeFs } from './node-fs';

/**
 * Tiny key-value store behind the demo stores (listings, accounts, OTP codes,
 * photos).
 *
 * - Node (development, `next start`, tests): a JSON/text file per key under the
 *   demo data directory, so separate route module graphs and server restarts
 *   share the same data.
 * - Workers: no filesystem exists, so the same keys live in isolate memory.
 *   Data is then per isolate and best-effort — a fixture demo on the hosted
 *   preview, never the durable path (that is Supabase, or D1 later).
 *
 * `node:fs` is reached through `nodeFs()` (never imported here), so the Worker
 * bundle has no filesystem dependency at all.
 *
 * The memory map hangs off `globalThis` so every bundle chunk inside one
 * isolate sees the same entries.
 */

type Entry = string | Uint8Array;
const MEMORY_KEY = Symbol.for('alisales.demo.memory');

function memory(): Map<string, Entry> {
  const g = globalThis as { [MEMORY_KEY]?: Map<string, Entry> };
  g[MEMORY_KEY] ??= new Map<string, Entry>();
  return g[MEMORY_KEY];
}

function fileFor(name: string): string {
  return join(demoDataDir(), name);
}

export function readText(name: string): string | null {
  const fs = nodeFs();
  if (!fs) {
    const value = memory().get(name);
    return typeof value === 'string' ? value : null;
  }
  try {
    const file = fileFor(name);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  } catch {
    return null;
  }
}

export function writeText(name: string, data: string): void {
  const fs = nodeFs();
  if (!fs) {
    memory().set(name, data);
    return;
  }
  const dir = demoDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fileFor(name), data, 'utf8');
}

/** Reads a JSON value, falling back to `empty` on a missing/torn file. */
export function readJson<T>(name: string, empty: () => T): T {
  const raw = readText(name);
  if (!raw) return empty();
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as T) : empty();
  } catch {
    return empty();
  }
}

export function writeJson(name: string, value: unknown): void {
  writeText(name, `${JSON.stringify(value, null, 2)}\n`);
}

export function readBytes(name: string): Uint8Array | null {
  const fs = nodeFs();
  if (!fs) {
    const value = memory().get(name);
    return value instanceof Uint8Array ? value : null;
  }
  try {
    const file = fileFor(name);
    return fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : null;
  } catch {
    return null;
  }
}

export function writeBytes(name: string, data: Uint8Array): void {
  const fs = nodeFs();
  if (!fs) {
    memory().set(name, data);
    return;
  }
  const dir = demoDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fileFor(name), data);
}
