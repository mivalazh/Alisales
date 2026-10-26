'use client';

import { useRef, useState } from 'react';
import { MAX_PHOTOS, toPersianDigits } from '@alisales/schemas';
import { PhotoPipelineError, processListingPhoto, type ProcessedPhoto } from '@/lib/photos';

interface Props {
  photos: ProcessedPhoto[];
  onChange: (photos: ProcessedPhoto[]) => void;
  /** Lets the form disable submit while files are still being processed. */
  onBusyChange?: (busy: boolean) => void;
  /** Server/client (schema) error for the photo set — e.g. «حداقل یک عکس لازم است». */
  error?: string;
}

export function PhotoUploader({ photos, onChange, onBusyChange, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remaining = MAX_PHOTOS - photos.length;

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setLocalError(null);

    const list = Array.from(files);
    const accepted = list.slice(0, Math.max(0, remaining));
    if (accepted.length < list.length) {
      setLocalError(`حداکثر ${toPersianDigits(MAX_PHOTOS)} عکس برای هر آگهی مجاز است.`);
    }
    if (accepted.length === 0) return;

    setBusy(true);
    onBusyChange?.(true);
    try {
      const added: ProcessedPhoto[] = [];
      for (const file of accepted) {
        try {
          added.push(await processListingPhoto(file));
        } catch (e) {
          setLocalError(
            e instanceof PhotoPipelineError ? e.message : 'پردازش عکس ناموفق بود؛ دوباره تلاش کنید.',
          );
        }
      }
      if (added.length > 0) onChange([...photos, ...added]);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(index: number): void {
    const target = photos[index];
    if (target) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number): void {
    if (index === 0) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    if (moved) next.unshift(moved);
    onChange(next);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label mb-0">عکس‌های خودرو</span>
        <span className="text-xs font-bold text-muted">
          {toPersianDigits(photos.length)} از {toPersianDigits(MAX_PHOTOS)}
        </span>
      </div>

      <p className="hint mb-2">
        اولین عکس به‌عنوان کاور آگهی نمایش داده می‌شود. اطلاعات مخفی عکس (EXIF)
        حذف و همه عکس‌ها به WebP تبدیل می‌شوند.
      </p>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li
            key={photo.previewUrl}
            className="relative aspect-[var(--photo-aspect)] overflow-hidden rounded-field border border-line bg-sunken"
          >
            {/* Object URLs are browser-local previews; next/image cannot process them. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={`پیش‌نمایش عکس ${toPersianDigits(index + 1)}`}
              className="h-full w-full object-cover"
            />
            {index === 0 ? (
              <span className="absolute top-1 start-1 rounded-[var(--radius-pill)] bg-cta px-2 py-0.5 text-[11px] font-extrabold text-ink">
                کاور
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(index)}
                className="absolute top-1 start-1 rounded-[var(--radius-pill)] border border-line bg-card/90 px-2 py-0.5 text-[11px] font-bold text-ink backdrop-blur hover:bg-card"
              >
                کاور شود
              </button>
            )}
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={`حذف عکس ${toPersianDigits(index + 1)}`}
              className="absolute bottom-1 end-1 flex h-7 w-7 items-center justify-center rounded-full bg-inverse/80 text-sm font-bold text-white backdrop-blur hover:bg-inverse"
            >
              ✕
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={remaining === 0 || busy}
            className="flex aspect-[var(--photo-aspect)] w-full flex-col items-center justify-center gap-1 rounded-field border border-dashed border-line-strong bg-card text-muted transition hover:border-cta hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs font-bold">
              {remaining === 0 ? 'سقف عکس تکمیل' : 'افزودن عکس'}
            </span>
          </button>
        </li>
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {busy && (
        <p className="hint" role="status">
          در حال پردازش عکس‌ها…
        </p>
      )}
      {localError && (
        <p className="error-text" role="alert">
          {localError}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
