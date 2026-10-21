import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Fixed fixture account ids (mirrored in supabase/seed_fixtures.sql). */
export const IDS = {
  admin: '00000000-0000-0000-0000-00000000000a',
  inspector: '00000000-0000-0000-0000-00000000000b',
  alice: '00000000-0000-0000-0000-00000000000c',
  bob: '00000000-0000-0000-0000-00000000000d',
  carol: '00000000-0000-0000-0000-00000000000e',
  dave: '00000000-0000-0000-0000-00000000000f',
  showroom: '00000000-0000-0000-0000-000000000010',
  basicSub: '00000000-0000-0000-0000-000000000020',
  report: '00000000-0000-0000-0000-000000000050',
} as const;

export const LISTINGS = {
  showroom206: '00000000-0000-0000-0000-000000000041',
  kioqiKish: '00000000-0000-0000-0000-000000000040',
  shahinTehran: '00000000-0000-0000-0000-000000000042',
  denaSold: '00000000-0000-0000-0000-000000000043',
  kioqiTransit: '00000000-0000-0000-0000-000000000044',
  peugeot206Blue: '00000000-0000-0000-0000-000000000045',
  peugeot206Black: '00000000-0000-0000-0000-000000000046',
  alice206: '00000000-0000-0000-0000-000000000047',
  aliceDraft: '00000000-0000-0000-0000-000000000048',
  hiddenSamaned: '00000000-0000-0000-0000-000000000049',
} as const;

const root = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

/** Fresh database with all migrations + seeds applied. */
export async function createDb(): Promise<PGlite> {
  const db = new PGlite();

  const migrations = root('supabase/migrations/');
  const files = readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    await db.exec(readFileSync(migrations + file, 'utf8'));
  }
  await db.exec(readFileSync(root('supabase/seed.sql'), 'utf8'));
  await db.exec(readFileSync(root('supabase/seed_fixtures.sql'), 'utf8'));
  return db;
}

/** Assume an authenticated identity (JWT claims + role). */
export async function asUser(
  db: PGlite,
  userId: string,
  role: 'authenticated' | 'service_role' = 'authenticated',
): Promise<void> {
  await db.exec(
    `set role ${role};
     select set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, role })}', false);`,
  );
}

/** Anonymous visitor: anon role, no subject claim. */
export async function asAnonymous(db: PGlite): Promise<void> {
  await db.exec(
    `set role anon; select set_config('request.jwt.claims', '', false);`,
  );
}

/** Back to migrations/seed context (superuser, no claims). */
export async function asSuper(db: PGlite): Promise<void> {
  await db.exec(
    `set role postgres; select set_config('request.jwt.claims', '', false);`,
  );
}

/** Move all of a user's listings back in time (clears rate-limit windows). */
export async function backdateListings(db: PGlite, userId: string, hours = 3): Promise<void> {
  await db.query(
    `update public.listings set created_at = created_at - ($2 || ' hours')::interval
     where created_by = $1`,
    [userId, String(hours)],
  );
}

export async function expectError(promise: Promise<unknown>, needle: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes(needle)) {
      throw new Error(`expected error containing "${needle}", got: ${message}`);
    }
    return;
  }
  throw new Error(`expected an error containing "${needle}", but the query succeeded`);
}
