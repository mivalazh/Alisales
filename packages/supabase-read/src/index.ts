/**
 * Supabase HTTP fetch with a hard latency budget for reads.
 *
 * Shared by the web and mobile data layers so both clients give up at the same
 * moment: a screen must never wait on an unhealthy database, and a phone on a
 * flaky connection must not hang on the platform's own (much longer) default.
 * Every read issued through this fetch is aborted after 2.5s, which turns a hung
 * connection into a thrown error the caller already handles.
 *
 * Only reads are budgeted. PostgREST answers `.select()` with GET and `.rpc()`
 * with POST, so both are covered; storage uploads (`/storage/v1/object/…`) and
 * table writes (POST/PATCH/DELETE on `/rest/v1/<table>`) are deliberately left
 * alone — a photo upload on a slow phone connection is not a stalled query, and
 * aborting it would lose the seller's file.
 *
 * This budget is per fetch attempt, so every client that installs it must also
 * pass `db: { retry: false }`: postgrest-js otherwise retries a rejected GET
 * three times (1s, 2s, 4s backoff), and each attempt would start a fresh 2.5s
 * clock, turning one stalled query into ~15s of waiting instead of 2.5s.
 */
export const SUPABASE_READ_TIMEOUT_MS = 2_500;

/**
 * `URL` is in the union because React Native's `fetch` types accept it; the
 * DOM `RequestInfo` type does not. Normalising to a string/`Request` below
 * keeps the call valid in both runtimes.
 */
type FetchInput = string | URL | Request;

function requestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function toRequestInfo(input: FetchInput): string | Request {
  return input instanceof URL ? input.href : input;
}

function isRead(input: FetchInput, init?: RequestInit): boolean {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : 'GET')
  ).toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  // PostgREST RPCs are POSTs; on a render path they are reads (search_listings,
  // get_seller_phone). A write RPC would pay the same budget, which is ample.
  return method === 'POST' && requestUrl(input).includes('/rest/v1/rpc/');
}

export function supabaseFetch(
  input: FetchInput,
  init?: RequestInit,
  /** Override for tests; production always uses the 2.5s constant. */
  timeoutMs: number = SUPABASE_READ_TIMEOUT_MS,
): Promise<Response> {
  if (!isRead(input, init)) return fetch(toRequestInfo(input), init);
  const budget = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, budget]) : budget;
  return fetch(toRequestInfo(input), { ...init, signal });
}
