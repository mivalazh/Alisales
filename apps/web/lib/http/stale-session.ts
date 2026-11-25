import { NextResponse } from 'next/server';
import { clearSessionCookie } from '../auth/session';

/**
 * A signed session can outlive the row it names.
 *
 * Cookies are stateless and last 30 days, but `public.users` can be emptied by
 * a database reset or a project migration. Writes that reference the missing
 * user then fail with a Postgres foreign-key violation (23503) and used to
 * surface as a 500. The cookie itself is still cryptographically valid, so the
 * only useful recovery is to drop it and ask for a fresh sign-in.
 */
export const STALE_SESSION_MESSAGE = 'نشست شما معتبر نیست؛ لطفاً دوباره وارد شوید.';

interface ErrorNode {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
}

function errorChain(error: unknown): ErrorNode[] {
  const chain: ErrorNode[] = [];
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current && typeof current === 'object'; depth++) {
    const node = current as ErrorNode;
    chain.push(node);
    current = node.cause;
  }
  return chain;
}

/**
 * Whether a write failed because its `created_by` / `author_id` points at a
 * user that no longer exists. The Postgres code is checked when the data layer
 * preserved it; the constraint name in the message is the fallback, so other
 * foreign-key failures (a missing vehicle row, for example) are not mistaken
 * for a stale session.
 */
export function isStaleSessionUser(error: unknown): boolean {
  const chain = errorChain(error);
  const code = chain.find((node) => typeof node.code === 'string')?.code;
  const message = chain
    .map((node) => (typeof node.message === 'string' ? node.message : ''))
    .join(' ');
  const foreignKey = code === '23503' || /violates foreign key constraint/i.test(message);
  return foreignKey && /(created_by|author_id|\busers\b)/i.test(message);
}

/** 401 that also expires the stale cookie, so the UI can prompt a re-login. */
export async function staleSessionResponse(): Promise<NextResponse> {
  await clearSessionCookie();
  return NextResponse.json(
    { ok: false, code: 'STALE_SESSION', error: STALE_SESSION_MESSAGE },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}
