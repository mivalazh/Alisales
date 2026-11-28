'use client';

/**
 * Phone/tablet publish bar.
 *
 * On a phone it sits above the tab bar (and above the raised «ثبت آگهی» FAB),
 * carries safe-area padding and a soft top shadow; from 640px it becomes a
 * flush bottom bar. Desktop (≥1024px) drops it entirely in favour of the
 * in-flow publish button at the end of the form.
 */
export function StickyPublishBar({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-30 border-t border-[#111144]/10 bg-[#F4F1EC]/95 px-4 py-3 shadow-[0_-10px_24px_-18px_rgba(17,17,68,0.55)] backdrop-blur-md dark:border-white/10 dark:bg-[#0B0D26]/95 sm:bottom-0 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="submit"
          disabled={disabled}
          className="btn-cta w-full text-sm disabled:opacity-60"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
