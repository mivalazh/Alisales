/**
 * Seller profile loading shell.
 *
 * It mirrors the real profile's cover, overlapping avatar, action row and
 * three-number grid, so verified and regular profiles settle into the same
 * layout instead of jumping or overlapping while the server read resolves.
 */
export default function SellerLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-4" aria-busy="true">
      <div className="h-10 w-40 rounded-full bg-sunken" />
      <section className="overflow-hidden rounded-card border border-line bg-card">
        <div className="h-32 w-full bg-sunken sm:h-44" />
        <div className="px-4 pb-4">
          <div className="-mt-9 flex items-end gap-3">
            <span className="h-[76px] w-[76px] shrink-0 rounded-full border-4 border-[color:var(--color-surface)] bg-sunken" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <span className="block h-4 w-1/2 rounded bg-sunken" />
              <span className="block h-3 w-1/4 rounded bg-sunken" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="h-11 w-32 rounded-full bg-sunken" />
            <span className="h-11 w-28 rounded-full bg-sunken" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-14 rounded-field bg-sunken" />
            ))}
          </div>
        </div>
      </section>
      <div className="flex gap-4 border-b border-line px-1 pb-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-6 flex-1 rounded bg-sunken" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="aspect-square rounded-field bg-sunken" />
        ))}
      </div>
    </div>
  );
}
