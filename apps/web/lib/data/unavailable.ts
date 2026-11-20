/**
 * "The data source is unavailable" as a first-class outcome.
 *
 * The hosted data layer used to swallow Supabase errors and return the same
 * `null` / `[]` / `false` it returns for a genuinely empty result, so a
 * transient outage looked to the user exactly like "you have no favorites",
 * "no notifications", "this phone has no account". Every read that depends on
 * Supabase now throws one of these instead, routes turn it into a 503 the
 * client can retry, and real emptiness keeps returning empty values.
 *
 * The message is fixed and safe: it never carries the provider's text, which
 * can name tables, columns or the project URL. The original error goes to the
 * server log here, once, at the point of failure.
 */

export const DATA_UNAVAILABLE_CODE = 'DATA_UNAVAILABLE';

/** Which store failed — readable in logs, stable enough to assert on. */
export type DataSource =
  | 'users'
  | 'favorites'
  | 'conversations'
  | 'messages'
  | 'profiles'
  | 'notifications';

export class DataUnavailableError extends Error {
  readonly code = DATA_UNAVAILABLE_CODE;

  constructor(
    readonly source: DataSource,
    /** Original provider error; for the log only, never for a response body. */
    override readonly cause: unknown,
  ) {
    super(`[alisales] ${source} store is temporarily unavailable`);
    this.name = 'DataUnavailableError';
  }
}

function detail(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(error);
}

/**
 * Log the provider detail once, server-side, and return the typed error.
 * Passing an existing unavailable error through is a no-op, so a rethrow inside
 * a `catch` cannot log the same failure twice.
 */
export function dataUnavailable(source: DataSource, error: unknown): DataUnavailableError {
  if (error instanceof DataUnavailableError) return error;
  console.warn(`[alisales] ${source} store unavailable:`, detail(error));
  return new DataUnavailableError(source, error);
}

/**
 * Recognise the unavailable state across module copies (bundler duplication,
 * an error restored from a cache), not just with `instanceof`.
 */
export function isDataUnavailable(error: unknown): error is DataUnavailableError {
  if (error instanceof DataUnavailableError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; name?: unknown };
  return candidate.code === DATA_UNAVAILABLE_CODE || candidate.name === 'DataUnavailableError';
}
