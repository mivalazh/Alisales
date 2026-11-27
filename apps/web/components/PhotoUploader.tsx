'use client';

import { useEffect, useRef, useState } from 'react';
import { MAX_PHOTOS } from '@alisales/schemas';
import {
  PhotoPipelineError,
  processListingMedia,
  uploadProcessedPhoto,
  type ProcessedPhoto,
} from '@/lib/photos';
import { useI18n } from '@/lib/i18n';
import { PhotoCropModal } from './listing-form/PhotoCropModal';

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/** Images first while the cover slot is still free. */
function rank(file: File): number {
  return isVideoFile(file) ? 1 : 0;
}

interface Props {
  photos: ProcessedPhoto[];
  onChange: (photos: ProcessedPhoto[]) => void;
  /** Lets the form disable submit while files are still being processed. */
  onBusyChange?: (busy: boolean) => void;
  /** Server/client (schema) error for the photo set — e.g. «حداقل یک عکس لازم است». */
  error?: string;
  /** Section label («عکس‌های خودرو» on create, «عکس‌های آگهی» on edit). */
  label?: string;
  /** The publish form lifts the counter into its section title row. */
  showCounter?: boolean;
}

export function PhotoUploader({
  photos,
  onChange,
  onBusyChange,
  error,
  label,
  showCounter = true,
}: Props) {
  const { t, lang } = useI18n();
  const coverRuleMessage = t(
    'تصویر اول (کاور آگهی) باید عکس باشد؛ در اسلات‌های بعدی می‌توانید ویدیو هم اضافه کنید',
    'The first slot (listing cover) must be an image; later slots can also include video.',
  );
  const resolvedLabel = label ?? t('عکس‌های خودرو', 'Vehicle photos');
  const filesRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  /** Newly picked stills, framed one at a time before they are uploaded. */
  const [queue, setQueue] = useState<ProcessedPhoto[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  /** «تنظیم کادر» on an already uploaded thumbnail. */
  const [editing, setEditing] = useState<{ photo: ProcessedPhoto; index: number } | null>(null);

  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const remaining = MAX_PHOTOS - photos.length;

  const finishIfIdle = (left: number) => {
    if (left > 0) return;
    setQueue([]);
    setQueueTotal(0);
    setBusy(false);
    onBusyChange?.(false);
  };

  async function handleFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    setLocalError(null);

    const list = Array.from(files);
    // Cover stays a still image: when the set is still empty, images move ahead
    // of any picked clips; a videos-only pick is refused with the rule text.
    const ordered = photos.length === 0 ? [...list].sort((a, b) => rank(a) - rank(b)) : list;
    const accepted = ordered.slice(0, Math.max(0, remaining));
    if (photos.length === 0 && accepted[0] && isVideoFile(accepted[0])) {
      setLocalError(coverRuleMessage);
      return;
    }
    if (accepted.length < list.length) {
      setLocalError(
        t(
          `حداکثر ${MAX_PHOTOS} عکس برای هر آگهی مجاز است.`,
          `A listing can have at most ${MAX_PHOTOS} photos.`,
        ),
      );
    }
    if (accepted.length === 0) return;

    setBusy(true);
    onBusyChange?.(true);
    let current = [...photosRef.current];
    const framed: ProcessedPhoto[] = [];
    try {
      for (const file of accepted) {
        let processed: ProcessedPhoto | null = null;
        try {
          // Images are compressed (EXIF dropped, WebP); clips go up as-is.
          // Either way the publish payload carries storage paths, not bytes.
          processed = await processListingMedia(file);
          // A still is framed first: the seller chooses the 4:3 crop before a
          // single byte leaves the device, so a tall photo never loses the car.
          if (processed.kind === 'image') {
            framed.push(processed);
            continue;
          }
          const uploaded = await uploadProcessedPhoto(processed);
          current = [...current, uploaded];
          photosRef.current = current;
          onChange(current);
        } catch (e) {
          if (processed) URL.revokeObjectURL(processed.previewUrl);
          setLocalError(
            e instanceof PhotoPipelineError
              ? e.message
              : t(
                  'پردازش یا بارگذاری عکس ناموفق بود؛ دوباره تلاش کنید.',
                  'Could not process or upload the photo; please try again.',
                ),
          );
        }
      }
    } finally {
      // Re-selecting the same file must fire `change` again.
      if (filesRef.current) filesRef.current.value = '';
      if (framed.length > 0) {
        setQueueTotal(framed.length);
        setQueue(framed);
      } else {
        finishIfIdle(0);
      }
    }
  }

  /** Upload one framed image (or the original when the seller skipped). */
  async function resolveCrop(next: ProcessedPhoto): Promise<void> {
    const head = queue[0];
    if (!head) return;
    const rest = queue.slice(1);
    setQueue(rest);
    try {
      const uploaded = await uploadProcessedPhoto(next);
      photosRef.current = [...photosRef.current, uploaded];
      onChange(photosRef.current);
      setLocalError(null);
    } catch (e) {
      setLocalError(
        e instanceof PhotoPipelineError
          ? e.message
          : t('بارگذاری عکس ناموفق بود؛ دوباره تلاش کنید.', 'Could not upload the photo; please try again.'),
      );
    } finally {
      finishIfIdle(rest.length);
    }
  }

  /** Re-frame an already uploaded thumbnail in place. */
  async function applyEdit(next: ProcessedPhoto): Promise<void> {
    const target = editing;
    setEditing(null);
    if (!target) return;
    setBusy(true);
    onBusyChange?.(true);
    try {
      const uploaded = await uploadProcessedPhoto(next);
      const replaced = photosRef.current.map((photo, index) =>
        index === target.index ? uploaded : photo,
      );
      photosRef.current = replaced;
      onChange(replaced);
      setLocalError(null);
    } catch (e) {
      setLocalError(
        e instanceof PhotoPipelineError
          ? e.message
          : t('بارگذاری عکس ناموفق بود؛ دوباره تلاش کنید.', 'Could not upload the photo; please try again.'),
      );
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function removeAt(index: number): void {
    const target = photos[index];
    if (target && target.blob) URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((_, i) => i !== index));
  }

  function makeCover(index: number): void {
    if (index === 0) return;
    const target = photos[index];
    if (!target) return;
    if (target.kind === 'video') {
      setLocalError(coverRuleMessage);
      return;
    }
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    if (moved) next.unshift(moved);
    onChange(next);
  }

  const cropTarget = editing?.photo ?? queue[0] ?? null;

  return (
    <div>
      {showCounter && (
        <div className="flex items-baseline justify-between gap-2">
          <span className="label mb-0">{resolvedLabel}</span>
          {/* Counted in Latin digits, like every other number in the form. */}
          <span className="text-xs font-bold tabular-nums text-muted">
            {lang === 'en' ? `${photos.length} of ${MAX_PHOTOS}` : `${photos.length} از ${MAX_PHOTOS}`}
          </span>
        </div>
      )}

      {/* Square thumbs: three to a phone row, five from `sm` up. */}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((photo, index) => (
          <li
            key={photo.previewUrl}
            className="relative aspect-square overflow-hidden rounded-field border border-line bg-sunken"
          >
            {/* Object URLs are browser-local previews; next/image cannot process them. */}
            {photo.kind === 'video' ? (
              <video
                src={photo.previewUrl}
                muted
                playsInline
                controls
                className="h-full w-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.previewUrl}
                alt={t(`پیش‌نمایش عکس ${index + 1}`, `Photo preview ${index + 1}`)}
                width={640}
                height={480}
                className="h-full w-full object-cover"
              />
            )}
            {photo.kind === 'video' ? (
              <span className="absolute top-1 start-1 rounded-[var(--radius-pill)] bg-inverse/80 px-2 py-0.5 text-[11px] font-extrabold text-white">
                {t('ویدیو', 'Video')}
              </span>
            ) : index === 0 ? (
              <span className="absolute top-1 start-1 rounded-[var(--radius-pill)] bg-cta px-2 py-0.5 text-[11px] font-extrabold text-ink">
                {t('کاور', 'Cover')}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeCover(index)}
                className="absolute top-1 start-1 rounded-[var(--radius-pill)] border border-line bg-card/90 px-2 py-0.5 text-[11px] font-bold text-ink backdrop-blur hover:bg-card"
              >
                {t('کاور شود', 'Make cover')}
              </button>
            )}
            {photo.kind === 'image' && (
              <button
                type="button"
                onClick={() => setEditing({ photo, index })}
                className="absolute bottom-1 start-1 rounded-[var(--radius-pill)] border border-white/40 bg-[#111144]/80 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur hover:bg-[#111144]"
              >
                {t('تنظیم کادر', 'Frame')}
              </button>
            )}
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={t(`حذف عکس ${index + 1}`, `Remove photo ${index + 1}`)}
              className="absolute bottom-1 end-1 flex h-7 w-7 items-center justify-center rounded-full bg-inverse/80 text-sm font-bold text-white backdrop-blur hover:bg-inverse"
            >
              ✕
            </button>
          </li>
        ))}

        <li>
          {/* One tap on the tile opens the OS picker (gallery, camera or files),
              which is the real permission boundary — no in-app source sheet. */}
          <button
            type="button"
            onClick={() => filesRef.current?.click()}
            disabled={remaining === 0 || busy}
            className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-field border border-dashed border-line-strong bg-card px-1 text-center text-muted transition hover:border-cta hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-xs font-bold">
              {remaining === 0
                ? t('سقف عکس تکمیل', 'Photo limit reached')
                : t('افزودن عکس یا ویدیو', 'Add photo or video')}
            </span>
          </button>
        </li>
      </ul>

      {/* iPhone photos are HEIC/HEIF by default, so both are offered here; the
          pipeline converts them to JPEG (1600px, quality 0.82) before upload,
          which also keeps the request under the 4.5 MB platform limit. */}
      <input
        ref={filesRef}
        type="file"
        accept="image/*,image/heic,image/heif,video/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {busy && (
        <p className="hint" role="status">
          {queue.length > 0
            ? t('در حال تنظیم کادر و بارگذاری عکس‌ها…', 'Framing and uploading photos…')
            : t('در حال پردازش و بارگذاری عکس‌ها…', 'Processing and uploading photos…')}
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

      {cropTarget && (
        <PhotoCropModal
          key={cropTarget.previewUrl}
          photo={cropTarget}
          position={editing ? editing.index + 1 : queueTotal - queue.length + 1}
          total={editing ? photos.length : queueTotal}
          onApply={(next) => {
            if (editing) void applyEdit(next);
            else void resolveCrop(next);
          }}
          onSkip={() => {
            if (editing) {
              setEditing(null);
              return;
            }
            const head = queue[0];
            if (head) void resolveCrop(head);
          }}
        />
      )}
    </div>
  );
}
