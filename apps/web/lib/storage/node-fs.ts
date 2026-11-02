import type * as NodeFs from 'node:fs';

/**
 * `node:fs`, fetched without a bundler-visible import.
 *
 * The demo stores keep their JSON on disk on Node. A Workers build has no
 * filesystem, and any static (or dynamic) `import ... from 'node:fs'` either
 * fails the bundle or throws while the worker module graph is being evaluated,
 * which would take the whole site down.
 *
 * Asking `process.getBuiltinModule` keeps `node:fs` out of the bundle entirely:
 * Node returns the real module, the Workers `process` shim has no such method
 * and the stores fall back to isolate memory.
 */

type FsModule = typeof NodeFs;

let cached: FsModule | null | undefined;

/**
 * Cloudflare Workers — including `wrangler dev` — expose `WebSocketPair` and
 * report this user agent. The runtime's `node:fs` shim exists but its files are
 * not shared between requests, so the demo stores must not use it there.
 */
function isWorkers(): boolean {
  const g = globalThis as {
    WebSocketPair?: unknown;
    navigator?: { userAgent?: string };
  };
  return typeof g.WebSocketPair === 'function' || g.navigator?.userAgent === 'Cloudflare-Workers';
}

export function nodeFs(): FsModule | null {
  if (cached !== undefined) return cached;
  if (isWorkers()) {
    cached = null;
    return cached;
  }
  try {
    const proc = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
      .process;
    const mod =
      typeof proc?.getBuiltinModule === 'function' ? proc.getBuiltinModule('node:fs') : null;
    cached =
      mod && typeof (mod as FsModule).readFileSync === 'function' ? (mod as FsModule) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** True on a runtime with a synchronous filesystem (Node, never Workers). */
export function hasDisk(): boolean {
  return nodeFs() !== null;
}
