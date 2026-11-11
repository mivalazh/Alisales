'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/**
 * Seller inspection-sheet viewer.
 *
 * The sheet is an uploaded image or scan, not a separate report page. It opens
 * over the listing, keeps the page (and the buyer's place) intact, and supports
 * zoom and a keyboard escape. The image src is exactly the stored upload URL.
 */
export function InspectionSheetLightbox({
  src,
  label,
}: {
  src: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function close(): void {
    setOpen(false);
    setZoomed(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#111144] px-3 py-2 text-[11px] font-extrabold text-white transition hover:bg-[#1b1b57] active:scale-[0.98] dark:bg-[#F98512] dark:text-[#111144] dark:hover:bg-[#ffa13d]"
      >
        <Icon name="shieldCheck" size={14} />
        {label}
      </button>

      {mounted &&
        open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-[#090b18]/90 p-3 backdrop-blur-sm sm:p-6"
            onClick={close}
          >
            <div
              className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#111144] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 text-white sm:px-4">
                <p className="truncate text-sm font-extrabold">{label}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoomed((value) => !value)}
                    aria-pressed={zoomed}
                    className="rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/85 transition hover:border-white/40 hover:text-white"
                  >
                    {zoomed ? '−' : '+'} Zoom
                  </button>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={close}
                    aria-label="Close inspection sheet"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-white/40 hover:bg-white/10"
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto bg-[#0b0d1c] p-2 sm:p-4">
                {/* The exact uploaded sheet, not a rendered HTML copy. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={label}
                  className={
                    zoomed
                      ? 'mx-auto max-w-none cursor-zoom-out'
                      : 'mx-auto max-h-[76dvh] w-auto max-w-full cursor-zoom-in object-contain'
                  }
                  onClick={() => setZoomed((value) => !value)}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
