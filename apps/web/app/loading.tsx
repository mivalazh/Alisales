import { CarLoader } from '@/components/CarLoader';

/** Root loading state: the coupe alone, centered on the theme canvas. */
export default function Loading() {
  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4"
      aria-busy="true"
      aria-label="Loading"
    >
      <CarLoader size="lg" />
      <p className="animate-pulse text-xs font-bold text-muted">در حال آماده‌سازی…</p>
    </div>
  );
}
