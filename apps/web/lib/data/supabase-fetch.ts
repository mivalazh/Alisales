/**
 * The read budget lives in `@alisales/supabase-read` so the mobile app pays the
 * same 2.5s per query. This module keeps the web data layer's established
 * import path (and its tests) unchanged.
 */
export { SUPABASE_READ_TIMEOUT_MS, supabaseFetch } from '@alisales/supabase-read';
