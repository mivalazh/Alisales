import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseFetch } from '@alisales/supabase-read';

/**
 * Mobile Supabase client with the same read budget as the web clients.
 *
 * `api.ts` only reaches this after it has confirmed `EXPO_PUBLIC_SUPABASE_*`
 * credentials, so a demo-mode session never creates a client. Reads abort after
 * 2.5s instead of hanging on the platform default; writes and photo uploads are
 * left unbudgeted so a slow connection cannot lose a seller's file. PostgREST
 * retries are off because the budget is per fetch attempt — each retry would
 * start a fresh 2.5s clock and stretch one stalled query to ~15s.
 *
 * Session persistence is deliberately left at the client default: unlike the
 * web clients (which are stateless per request), the app is the session.
 */
export function createMobileSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    db: { retry: false },
    global: { fetch: supabaseFetch },
  });
}
