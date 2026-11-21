/**
 * Supabase HTTP fetch with a hard latency budget for reads.
 *
 * A page render must never wait on an unhealthy database. Every read issued
 * through this fetch is aborted after 2.5s, which turns a hung connection into a
 * thrown error the data layer already catches and replaces with the seeded or
 * cached rows. Without it, a PostgREST hiccup can hold a request open for the
 * platform's own (much longer) default timeout.
 *
 * Only reads are budgeted. PostgREST answers `.select()` with GET and `.rpc()`
 * with POST, so both are covered; storage uploads (`/storage/v1/object/…`) and
 * table writes (POST/PATCH/DELETE on `/rest/v1/<table>`) are deliberately left
 * alone — a photo upload on a slow phone connection is not a stalled query, and
 * aborting it would lose the seller's file.
 */
export const SUPABASE_READ_TIMEOUT_MS = 2_500;

type FetchInput = Parameters<typeof fetch>[0];

function requestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
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
  if (!isRead(input, init)) return fetch(input, init);
  const budget = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, budget]) : budget;
  return fetch(input, { ...init, signal });
}
