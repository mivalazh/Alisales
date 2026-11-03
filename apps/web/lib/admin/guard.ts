import { adminAccess, canSeeAdminLink, parseAdminPhones, ADMIN_PHONES_ENV } from './rules';
import { getSession, type SessionUser } from '../auth/session';
import { fixtureMode } from '../config/mode';

/**
 * Server-side admin gate. Call this from any page or route handler that touches
 * moderation data — never trust a client flag.
 *
 * `adminSession()` returns the session when the visitor may moderate, else
 * null; the caller decides between `notFound()` (page) and 403 (API).
 */
export async function adminSession(): Promise<SessionUser | null> {
  const { session, access } = await adminGate();
  return access === 'admin' ? session : null;
}

/** Session + access in one call, so a page can redirect a guest but 404 a
 * signed-in stranger (the hub should not advertise itself). */
export async function adminGate(): Promise<{
  session: SessionUser | null;
  access: 'admin' | 'forbidden' | 'guest';
}> {
  const session = await getSession();
  const access = adminAccess(
    session?.phone,
    parseAdminPhones(process.env[ADMIN_PHONES_ENV]),
    fixtureMode(),
  );
  return { session, access };
}

/** Whether the header should offer the moderation link to this visitor. */
export async function showAdminLink(): Promise<boolean> {
  const session = await getSession();
  return canSeeAdminLink(
    adminAccess(session?.phone, parseAdminPhones(process.env[ADMIN_PHONES_ENV]), fixtureMode()),
  );
}
