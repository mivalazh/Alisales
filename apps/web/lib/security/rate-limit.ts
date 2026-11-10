/**
 * Small fixed-window limiter for the public write endpoints (OTP, chat,
 * reports). It is intentionally process-local: on a single Node server it is a
 * real limit, and on Workers each isolate enforces its own window. That still
 * stops accidental double-submits and simple floods without adding a network
 * dependency to every request. A hosted deployment can swap the store for a
 * shared KV/Redis implementation behind the same function.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 5_000;

export interface RateLimitOptions {
  request: Request;
  bucket: string;
  limit: number;
  windowMs: number;
  /** Prefer an authenticated user id over the client address when available. */
  key?: string;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

function clientAddress(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    forwarded ||
    'local'
  );
}

function prune(now: number): void {
  if (windows.size < MAX_KEYS) return;
  for (const [key, value] of windows) {
    if (value.resetAt <= now) windows.delete(key);
  }
  // If every entry is still live, drop the oldest insertion-order windows.
  while (windows.size >= MAX_KEYS) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) break;
    windows.delete(oldest);
  }
}

export function rateLimit(options: RateLimitOptions): RateLimitResult {
  const { request, bucket, limit, windowMs, key } = options;
  const now = Date.now();
  prune(now);

  const identity = key?.trim() || clientAddress(request);
  const storageKey = `${bucket}:${identity}`;
  const existing = windows.get(storageKey);

  if (!existing || existing.resetAt <= now) {
    windows.set(storageKey, { count: 1, resetAt: now + windowMs });
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}
