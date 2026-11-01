import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { smsConfigured } from '../auth/sms';

/**
 * Runtime mode for the web app (S3 demo/preview hardening).
 *
 * Two things are decided here, and nothing else in the app branches on
 * `NODE_ENV` for them:
 *
 *  1. Where data lives. With Supabase service credentials the app is hosted;
 *     without them it is a fixture/demo deployment that keeps its JSON store
 *     on disk — even in a production build, so a cloud preview link never
 *     answers 503 just because the owner has not connected Supabase yet.
 *  2. Whether the demo affordances are allowed (OTP printed to the server log
 *     and, behind an explicit public flag, echoed to the OTP step so the owner
 *     can sign in on a preview link).
 *
 * `REQUIRE_HOSTED_SERVICES=true` is the strict switch: it disables both
 * fallbacks and restores the old "configure the services or get 503" behavior,
 * which is what a real deployment should use once credentials exist.
 */

/** True for '1', 'true', 'yes', 'on' (case-insensitive). */
function flagOn(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/** Supabase URL + service role key: the app can read AND write real rows. */
export function hostedDataConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Public Supabase credentials: browse/search reads the hosted RPC. */
export function hostedReadsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Operator explicitly requires real services (no fixture fallback). */
export function requireHostedServices(): boolean {
  return flagOn(process.env.REQUIRE_HOSTED_SERVICES);
}

/**
 * Fixture/demo data mode: no Supabase write credentials and no strict switch.
 *
 * In this mode listings, accounts, views, chat and reports live in the local
 * JSON store (see `demoDataDir`), in development and in production alike.
 */
export function fixtureMode(): boolean {
  if (requireHostedServices()) return false;
  return !hostedDataConfigured();
}

/**
 * Demo OTP mode: there is no real data store and no SMS provider, so login
 * codes are printed to the server console instead of being sent.
 *
 * Deliberately requires BOTH: a hosted deployment without SMS stays 503 (that
 * combination means real users and no delivery channel), and an SMS-configured
 * deployment always sends for real.
 */
export function demoAuthMode(): boolean {
  return fixtureMode() && !smsConfigured();
}

/**
 * Public, documented demo switch. When on, the OTP step also shows the code
 * that was written to the server log, so the owner can sign in on the preview
 * link without console access. Never turn this on for a real deployment.
 */
export function demoOtpHintEnabled(): boolean {
  return demoAuthMode() && flagOn(process.env.NEXT_PUBLIC_DEMO_OTP_HINT);
}

const PRIMARY_DIR = join(process.cwd(), '.dev-data');
const FALLBACK_DIR = join(tmpdir(), 'alisales-demo-data');

let resolvedDir: string | null = null;

/** Can we actually write into this directory? (cloud previews may be read-only) */
function writable(dir: string): boolean {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, '.write-probe');
    writeFileSync(probe, '1');
    rmSync(probe, { force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Directory for the fixture store.
 *
 * `.dev-data` next to the app is the normal location; when the root filesystem
 * is read-only (some cloud preview sandboxes) the store moves to
 * `/tmp/alisales-demo-data` so listings, accounts and OTP records still persist
 * across requests. Resolved once per process and shared by every store.
 */
export function demoDataDir(): string {
  if (resolvedDir) return resolvedDir;
  if (writable(PRIMARY_DIR)) {
    resolvedDir = PRIMARY_DIR;
  } else {
    writable(FALLBACK_DIR);
    resolvedDir = FALLBACK_DIR;
  }
  return resolvedDir;
}

/**
 * Secret used to sign session cookies.
 *
 * Development always had a fixed local secret; a fixture/demo deployment needs
 * one too or nobody could sign in on a preview. A hosted deployment still
 * requires a real AUTH_SECRET (None → routes answer 503).
 */
export const DEMO_AUTH_SECRET = 'alisales-demo-secret-not-for-production';
