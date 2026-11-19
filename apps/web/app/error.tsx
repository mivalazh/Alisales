'use client';

import { useEffect, useRef } from 'react';
import { reportBoundaryError } from '@/lib/monitoring/client';

/** Persian-language error boundary — spec requires all error messages in فارسی. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // A failed render must reach the owner, not just the visitor. One report per
  // failure: React can re-run effects, and repeat digests are grouped anyway.
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current) return;
    reported.current = true;
    reportBoundaryError(error, undefined, 'boundary');
  }, [error]);

  return (
    <div className="rounded-card border border-line bg-card px-6 py-12 text-center">
      <p className="text-lg font-extrabold">خطایی رخ داد</p>
      <p className="mt-1 text-sm text-muted">
        در نمایش این صفحه مشکلی پیش آمد. لطفاً دوباره تلاش کنید.
      </p>
      <button type="button" onClick={reset} className="btn-cta mt-4 text-sm">
        تلاش دوباره
      </button>
    </div>
  );
}
