import { localizedMetadata } from '@/lib/i18n/metadata';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'ورود' },
  { title: 'Sign in' },
);

/** Login — phone + one-time code (S2 / C4). */
export default async function LoginPage() {
  const lang = await getLanguage();
  return (
    <Suspense
      fallback={
        <p className="text-center text-sm text-muted">
          {serverT(lang, 'در حال بارگذاری…', 'Loading…')}
        </p>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
