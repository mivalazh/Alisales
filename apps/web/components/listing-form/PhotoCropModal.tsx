'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/lib/i18n';
import { useModalFocus } from '@/lib/useModalFocus';
import type { ProcessedPhoto } from '@/lib/photos';

/** The listing frame is 4:3 everywhere (gallery, thumbnails, crop output). */
const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 960;
const MAX_ZOOM = 2.5;

type Offset = { x: number; y: number };

/**
 * «تنظیم کادر» — pan and zoom a photo inside the exact 4:3 listing frame.
 *
 * The preview and the exported file share one transform, so what the seller
 * frames is byte-for-byte what gets uploaded: `drawImage` paints the visible
 * 4:3 window at 1280×960, the same pipeline compression as a normal pick.
 * Pointer events cover mouse, touch and pen; the slider covers fine zoom.
 */
export function PhotoCropModal({
  photo,
  position,
  total,
  onApply,
  onSkip,
}: {
  photo: ProcessedPhoto;
  /** 1-based position in the set being framed, for the counter. */
  position: number;
  total: number;
  /** The framed image, ready to upload. */
  onApply: (cropped: ProcessedPhoto) => void;
  /** Keep the original framing (also the close action). */
  onSkip: () => void;
}) {
  const { t } = useI18n();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  useModalFocus({ active: true, containerRef: sheetRef, onClose: onSkip });

  useEffect(() => {
    let alive = true;
    const img = new Image();
    // Same-origin/`/api/photos` previews and CORS-enabled storage both export
    // cleanly; a tainted canvas surfaces as a readable error below.
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (alive) setImage(img);
    };
    img.onerror = () => {
      if (alive) setFailed(true);
    };
    img.src = photo.previewUrl;
    return () => {
      alive = false;
    };
  }, [photo.previewUrl]);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const measure = () =>
      setViewport({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Cover-fit at 1×, then the seller's zoom and drag, clamped to the frame. */
  const layout = useCallback(
    (img: HTMLImageElement) => {
      const base =
        viewport.width > 0
          ? Math.max(viewport.width / img.naturalWidth, viewport.height / img.naturalHeight)
          : 1;
      const scale = base * zoom;
      const width = img.naturalWidth * scale;
      const height = img.naturalHeight * scale;
      const minX = Math.min(0, viewport.width - width);
      const minY = Math.min(0, viewport.height - height);
      const dx = Math.max(minX, Math.min(0, (viewport.width - width) / 2 + offset.x));
      const dy = Math.max(minY, Math.min(0, (viewport.height - height) / 2 + offset.y));
      return { scale, dx, dy, width, height };
    },
    [offset.x, offset.y, viewport.height, viewport.width, zoom],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image || viewport.width === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.width * dpr);
    canvas.height = Math.round(viewport.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewport.width, viewport.height);
    const { dx, dy, width, height } = layout(image);
    ctx.drawImage(image, dx, dy, width, height);
  }, [image, layout, viewport.height, viewport.width]);

  async function apply(): Promise<void> {
    if (!image || busy || viewport.width === 0) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unavailable');
      const { dx, dy, scale } = layout(image);
      const ratio = OUTPUT_WIDTH / viewport.width;
      ctx.drawImage(
        image,
        dx * ratio,
        dy * ratio,
        image.naturalWidth * scale * ratio,
        image.naturalHeight * scale * ratio,
      );
      const mime = photo.mime === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, 0.85),
      );
      if (!blob) throw new Error('encode failed');
      onApply({
        ...photo,
        mime,
        blob,
        previewUrl: URL.createObjectURL(blob),
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT,
        bytes: blob.size,
        path: null,
        url: null,
      });
    } catch {
      setError(
        t(
          'برش این تصویر ممکن نشد؛ از تصویر اصلی استفاده کنید.',
          'Could not crop this image; use the original.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#111144]/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('تنظیم کادر عکس', 'Frame this photo')}
        tabIndex={-1}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-card shadow-2xl focus:outline-none"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <p className="min-w-0 flex-1 text-sm font-extrabold text-ink">
            {t('تنظیم کادر عکس', 'Frame this photo')}
          </p>
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted">
            {position} {t('از', 'of')} {total}
          </span>
          <button
            type="button"
            onClick={onSkip}
            aria-label={t('بستن', 'Close')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          <div
            ref={frameRef}
            onPointerDown={(event) => {
              if (!image) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                baseX: offset.x,
                baseY: offset.y,
              };
            }}
            onPointerMove={(event) => {
              const state = drag.current;
              if (!state || state.pointerId !== event.pointerId) return;
              setOffset({
                x: state.baseX + (event.clientX - state.startX),
                y: state.baseY + (event.clientY - state.startY),
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
            className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-xl bg-black"
          >
            <canvas
              ref={canvasRef}
              aria-label={t('پیش‌نمایش کادر ۴:۳', '4:3 crop preview')}
              className="h-full w-full cursor-move"
            />
            {!image && !failed && (
              <p className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/70">
                {t('در حال آماده‌سازی تصویر…', 'Preparing the image…')}
              </p>
            )}
            {failed && (
              <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs font-bold text-white/80">
                {t(
                  'این تصویر در مرورگر باز نشد؛ از تصویر اصلی استفاده کنید.',
                  'This image could not be opened here; use the original.',
                )}
              </p>
            )}
            {/* Rule-of-thirds guides: a quiet framing aid, never a crop. */}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/15" />
          </div>

          <label className="flex items-center gap-3">
            <span className="shrink-0 text-xs font-bold text-muted">
              {t('بزرگ‌نمایی', 'Zoom')}
            </span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              aria-label={t('بزرگ‌نمایی کادر', 'Crop zoom')}
              className="h-9 min-w-0 flex-1 accent-[#111144] dark:accent-[#F98513]"
            />
            <span className="w-12 shrink-0 text-end text-xs font-extrabold tabular-nums text-ink">
              {zoom.toFixed(1)}x
            </span>
          </label>

          <p className="text-[11px] leading-5 text-muted">
            {t(
              'عکس را بکشید تا جای خودرو در کادر ۴:۳ مشخص شود؛ نسبت کادر با نمایش آگهی یکسان است.',
              'Drag the photo to place the car inside the 4:3 frame — the same ratio the listing shows.',
            )}
          </p>

          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5 sm:px-4">
          <button type="button" onClick={onSkip} className="btn-ghost text-sm">
            {t('استفاده از تصویر اصلی', 'Use the original')}
          </button>
          <button
            type="button"
            onClick={() => void apply()}
            disabled={!image || busy}
            className="btn-cta text-sm disabled:opacity-60"
          >
            {busy ? t('در حال برش…', 'Cropping…') : t('اعمال کادر', 'Apply frame')}
          </button>
        </div>
      </div>
    </div>
  );
}
