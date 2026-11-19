/**
 * "Post an ad" loading shell.
 *
 * The form is client-rendered and heavy, so the page paints its heading and the
 * first field groups immediately instead of an empty frame.
 */
export default function NewListingLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="در حال بارگذاری فرم ثبت آگهی">
      <div className="flex items-center justify-between gap-2">
        <span className="block h-6 w-24 rounded-full bg-sunken" />
        <span className="block h-9 w-20 rounded-full bg-sunken/60" />
      </div>

      <section className="space-y-3 rounded-card border border-line bg-card p-4">
        <span className="block h-4 w-28 rounded-full bg-sunken" />
        <div className="flex gap-2">
          <span className="h-20 w-20 shrink-0 rounded-field bg-sunken/60" />
          <span className="h-20 flex-1 rounded-field bg-sunken/40" />
        </div>
      </section>

      {[0, 1, 2].map((group) => (
        <section key={group} className="space-y-3 rounded-card border border-line bg-card p-4">
          <span className="block h-4 w-32 rounded-full bg-sunken" />
          <div className="grid gap-3 sm:grid-cols-2">
            <span className="block h-11 rounded-field bg-sunken/50" />
            <span className="block h-11 rounded-field bg-sunken/50" />
          </div>
          <span className="block h-11 rounded-field bg-sunken/40" />
        </section>
      ))}

      <span className="block h-12 w-full rounded-full bg-sunken" />
    </div>
  );
}
