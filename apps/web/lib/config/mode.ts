import { join } from 'node:path';
import { isValidMobile, normalizePhone } from '@alisales/schemas';
import { smsConfigured } from '../auth/sms';
import { nodeFs } from '../storage/node-fs';

/**
 * Runtime mode for the web app (S3 demo/preview hardening).
 *
 * Two things are decided here, and nothing else in the app branches on
 * `NODE_ENV` for them:
 *
 *  1. Where data lives. With Supabase service credentials the app is hosted;
 *     without them a development build uses the fixture store. Production is
 *     always strict and answers 503 instead of serving fixture data. On a
 *     runtime with no filesystem (Workers) the development store is isolate
 *     memory; see `lib/storage/demo-store.ts`.
 *  2. Whether instant OTP is available. Development without SMS allows every
 *     number. Production without SMS allows only the explicitly configured
 *     `INSTANT_OTP_ALLOWLIST`, so a missing provider never turns arbitrary
 *     phone numbers into accounts. Configuring SMS disables instant OTP.
 *
 * `REQUIRE_HOSTED_SERVICES=true` remains available to force strict mode in a
 * non-production environment, but it is no longer required for production.
 */

/** True for '1', 'true', 'yes', 'on' (case-insensitive). */
function flagOn(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
}

/**
 * Server-side Supabase project URL.
 *
 * `NEXT_PUBLIC_SUPABASE_URL` is the one variable every deployment already has;
 * `SUPABASE_URL` remains accepted as an explicit server override. Reading both
 * keeps the browser reads and the service-role writes pointed at one project.
 */
export function serverSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Supabase URL + service role key: the app can read AND write real rows. */
export function hostedDataConfigured(): boolean {
  return Boolean(serverSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Public Supabase credentials: browse/search reads the hosted RPC. */
export function hostedReadsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * Launch-day switch: when true, no seeded sample listing or sample story is
 * served. Real listings written to Supabase or the dev store stay visible.
 */
export function demoListingsHidden(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_HIDE_DEMO_LISTINGS);
}

/**
 * Operator explicitly requires real services (no fixture fallback).
 *
 * Production builds are always strict: the fixture fallback exists for local
 * development and review builds, never for a real deployment. Keeping this
 * independent of an environment flag means a missing flag cannot silently
 * bring the demo store or demo login back after a cutover.
 */
export function requireHostedServices(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  return flagOn(process.env.REQUIRE_HOSTED_SERVICES);
}

/**
 * Fixture/demo data mode: no Supabase write credentials and no strict switch.
 *
 * In this mode listings, accounts, views, chat and reports live in the demo
 * store (see `demoDataDir`). Production never enters this mode.
 */
export function fixtureMode(): boolean {
  if (requireHostedServices()) return false;
  return !hostedDataConfigured();
}

/**
 * Instant OTP path exists when no SMS provider is configured. This only says
 * the flow is possible; `instantOtpAllowedFor()` decides which phone may use it.
 */
export function demoAuthMode(): boolean {
  return !smsConfigured();
}

/**
 * Phone numbers explicitly allowed to use instant OTP in production.
 * Comma/space/semicolon separated; Persian digits, `+98` and `0098` normalize.
 * There is deliberately no wildcard or allow-all switch.
 */
function instantOtpAllowlist(): ReadonlySet<string> {
  const entries = String(process.env.INSTANT_OTP_ALLOWLIST ?? '')
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizePhone)
    .filter(isValidMobile);
  return new Set(entries);
}

/**
 * Whether a phone may use the instant/devCode fallback when the gateway is
 * unavailable or rejects an unverified/sandbox account. Development allows
 * every number; production still requires the exact launch allowlist, so an
 * SMS.ir failure cannot turn arbitrary phones into accounts.
 */
export function instantOtpFallbackAllowedFor(rawPhone: string): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return instantOtpAllowlist().has(normalizePhone(rawPhone));
}

/**
 * Authorize the no-SMS instant flow for one phone. A configured SMS provider
 * always wins and disables this path; its sandbox fallback is checked through
 * `instantOtpFallbackAllowedFor()` instead.
 */
export function instantOtpAllowedFor(rawPhone: string): boolean {
  if (smsConfigured()) return false;
  return instantOtpFallbackAllowedFor(rawPhone);
}

/** Whether the instant code can be shown at all (optionally for one phone). */
export function demoOtpHintEnabled(phone?: string): boolean {
  if (!demoAuthMode()) return false;
  if (phone) return instantOtpAllowedFor(phone);
  return process.env.NODE_ENV !== 'production' || instantOtpAllowlist().size > 0;
}

const PRIMARY_DIR = join(process.cwd(), '.dev-data');
const FALLBACK_DIR = '/tmp/alisales-demo-data';
const DATA_DIR_ENV = 'DEMO_DATA_DIR';

let resolvedDir: string | null = null;

/** Can we actually write into this directory? (cloud previews may be read-only) */
function writable(dir: string): boolean {
  const fs = nodeFs();
  if (!fs) return false;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = join(dir, '.write-probe');
    fs.writeFileSync(probe, '1');
    fs.rmSync(probe, { force: true });
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
 * across requests. On Workers there is no filesystem at all and the demo store
 * keeps everything in isolate memory, so this path is only a stable key.
 */
export function demoDataDir(): string {
  // Tests and local harnesses can point every demo store at an isolated dir.
  const override = process.env[DATA_DIR_ENV]?.trim();
  if (override) return override;
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
