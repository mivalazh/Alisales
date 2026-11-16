import { localizedMetadata } from '@/lib/i18n/metadata';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export const generateMetadata = localizedMetadata(
  { title: 'ورود' },
  { title: 'Sign in' },
);

/** Login — phone + one-time code (S2 / C4). */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
