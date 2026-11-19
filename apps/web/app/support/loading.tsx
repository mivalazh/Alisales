/**
 * Support loading shell.
 *
 * Follows the ticket centre's real rhythm — heading row with the cooperation
 * button, the new-ticket action, the search field, the ticket table and the 2×2
 * guide grid — so the page never collapses to a blank column while the ticket
 * store resolves.
 */
export default function SupportLoading() {
  return (
    <div className="mx-auto mt-3 max-w-4xl animate-pulse space-y-5 sm:mt-4" aria-busy="true" aria-label="در حال بارگذاری پشتیبانی">
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <span className="block h-5 w-32 rounded-full bg-sunken" />
            <span className="block h-3 w-56 rounded bg-sunken/60" />
          </div>
          <span className="h-10 w-28 shrink-0 rounded-full bg-sunken" />
        </div>

        <span className="block h-11 w-full rounded-full bg-sunken" />
        <span className="block h-11 w-full rounded-field bg-sunken/60" />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between rounded-field bg-sunken/40 px-3 py-2">
          <span className="h-3 w-14 rounded bg-sunken" />
          <span className="h-3 w-14 rounded bg-sunken" />
        </div>
        {[0, 1, 2].map((index) => (
          <span key={index} className="block h-12 rounded-field border border-line bg-card" />
        ))}
        <span className="mx-auto block h-14 w-14 rounded-full bg-sunken/50" />
        <span className="mx-auto block h-3 w-40 rounded bg-sunken/60" />
      </section>

      <section className="space-y-3">
        <span className="block h-5 w-40 rounded-full bg-sunken" />
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className="aspect-square rounded-card border border-line bg-sunken/50" />
          ))}
        </div>
      </section>

      <span className="block h-20 max-w-sm rounded-card border border-line bg-sunken/40" />
    </div>
  );
}
