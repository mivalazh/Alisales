import { redirect } from 'next/navigation';
import { loginHref } from '@alisales/schemas';
import { getSession, type SessionUser } from './session';

/**
 * Server guard for signed-in pages.
 *
 * The return path goes through `safeNextPath`, so only same-site paths can
 * ever reach `/login?next=…`; an external URL is replaced by `/`.
 */
export async function requireUser(next: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(loginHref(next));
  return session;
}
