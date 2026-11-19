/**
 * Profile loading shell (also covers /profile/listings, /settings and /stats).
 *
 * Same geometry as the real hub: cover, overlapping avatar, name block, the
 * stats grid, the shortcut cards and the listing grid, so a slow account read
 * never flashes an empty page.
 */
export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-4" aria-busy="true" aria-label="در حال بارگذاری پروفایل">
      <div className="h-5 w-28 rounded-full bg-sunken" />

      <section className="overflow-hidden rounded-card border border-line bg-card">
        <div className="h-28 w-full bg-sunken sm:h-36" />
        <div className="px-4 pb-4">
          <div className="-mt-8 flex items-end gap-3">
            <span className="h-[72px] w-[72px] shrink-0 rounded-full border-4 border-[color:var(--color-surface)] bg-sunken" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <span className="block h-4 w-1/2 rounded bg-sunken" />
              <span className="block h-3 w-1/3 rounded bg-sunken" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="h-11 w-32 rounded-full bg-sunken" />
            <span className="h-11 w-24 rounded-full bg-sunken" />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((index) => (
          <span key={index} className="h-16 rounded-card border border-line bg-sunken/60" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="h-20 rounded-card border border-line bg-sunken/60" />
        ))}
      </div>

      <div className="flex gap-4 border-b border-line px-1 pb-2">
        {[0, 1, 2].map((index) => (
          <span key={index} className="h-5 flex-1 rounded bg-sunken" />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} className="aspect-[5/4] rounded-card bg-sunken/50" />
        ))}
      </div>
    </div>
  );
}
