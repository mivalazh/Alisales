import { NextResponse } from 'next/server';
import { isValidMobile, normalizePhone } from '@alisales/schemas';
import { authSecret, createSessionToken, getSession, setSessionCookie } from '@/lib/auth/session';
import {
  clearPasswordFailures,
  hashPassword,
  hasPassword,
  notePasswordFailure,
  passwordAttemptsExceeded,
  passwordProblem,
  savePasswordHash,
  verifyStoredPassword,
} from '@/lib/auth/password';
import { findUserByPhone, getUser } from '@/lib/data/s2-store';

/**
 * POST /api/auth/password — password login { phone, password }.
 *
 * The answer is deliberately identical for an unknown phone, a phone without a
 * password and a wrong password, so the endpoint cannot be used to discover
 * which numbers have accounts. Wrong tries are throttled per phone.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authSecret()) {
    return NextResponse.json(
      { error: 'ورود در حال حاضر در دسترس نیست؛ بعداً تلاش کنید.' },
      { status: 503 },
    );
  }

  let body: { phone?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { phone?: unknown; password?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const phoneRaw = typeof body.phone === 'string' ? body.phone : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!isValidMobile(phoneRaw)) {
    return NextResponse.json({ error: 'شماره موبایل معتبر نیست.' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: 'رمز عبور را وارد کنید.' }, { status: 400 });
  }
  const phone = normalizePhone(phoneRaw);

  if (passwordAttemptsExceeded(phone)) {
    return NextResponse.json(
      { error: 'تلاش‌های ناموفق زیاد بود؛ چند دقیقه بعد یا با کد پیامکی وارد شوید.' },
      { status: 429 },
    );
  }

  const account = await findUserByPhone(phone);
  const valid = account ? await verifyStoredPassword(phone, password) : false;
  if (!account || !valid) {
    notePasswordFailure(phone);
    return NextResponse.json({ error: 'شماره یا رمز عبور نادرست است.' }, { status: 401 });
  }

  clearPasswordFailures(phone);
  const token = await createSessionToken({
    sub: account.id,
    phone: account.phone,
    displayName: account.displayName,
    accountType: account.accountType,
  });
  await setSessionCookie(token);
  return NextResponse.json({
    ok: true,
    user: {
      id: account.id,
      displayName: account.displayName,
      accountType: account.accountType,
    },
  });
}

/**
 * PUT /api/auth/password — set or change the signed-in account's password.
 *
 * Changing an existing password requires the current one; setting the first
 * password does not (the session itself is the proof, it was opened with the
 * SMS code). The SMS login keeps working either way, so nobody is locked out.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'برای تنظیم رمز عبور وارد حساب شوید.' }, { status: 401 });
  }

  let body: { password?: unknown; currentPassword?: unknown };
  try {
    body = (await request.json()) as { password?: unknown; currentPassword?: unknown };
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  const problem = passwordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const account = await getUser(session.sub);
  if (!account) return NextResponse.json({ error: 'حساب پیدا نشد.' }, { status: 404 });

  if (hasPassword(account.phone)) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!current || !(await verifyStoredPassword(account.phone, current))) {
      return NextResponse.json({ error: 'رمز عبور فعلی درست نیست.' }, { status: 401 });
    }
  }

  savePasswordHash(account.phone, await hashPassword(password));
  clearPasswordFailures(account.phone);
  return NextResponse.json({ ok: true });
}

/** GET — does this account already have a password? (settings page) */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ hasPassword: false });
  return NextResponse.json({ hasPassword: hasPassword(session.phone) });
}
