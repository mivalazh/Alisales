'use client';

/** Persian-language error boundary — spec requires all error messages in فارسی. */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
