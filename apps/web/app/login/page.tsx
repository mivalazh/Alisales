import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = { title: 'ورود' };

/** Login — phone + one-time code (S2 / C4). */
export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted">در حال بارگذاری…</p>}>
      <LoginForm />
    </Suspense>
  );
}
