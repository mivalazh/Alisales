'use client';

import { useRef, useState } from 'react';
import { MAX_PHOTOS, toPersianDigits } from '@alisales/schemas';
import {
  PhotoPipelineError,
  processListingMedia,
  uploadProcessedPhoto,
  type ProcessedPhoto,
} from '@/lib/photos';
import { useI18n } from '@/lib/i18n';

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
}

export function PhotoUploader({
  photos,
  onChange,
  onBusyChange,
  error,
  label,
}: Props) {
  const { t, lang } = useI18n();
  const coverRuleMessage = t(
    'تصویر اول (کاور آگهی) باید عکس باشد؛ در اسلات‌های بعدی می‌توانید ویدیو هم اضافه کنید',
    'The first slot (listing cover) must be an image; later slots can also include video.',
  );
  const resolvedLabel = label ?? t('عکس‌های خودرو', 'Vehicle photos');
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const remaining = MAX_PHOTOS - photos.length;

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
          `حداکثر ${toPersianDigits(MAX_PHOTOS)} عکس برای هر آگهی مجاز است.`,
          `A listing can have at most ${MAX_PHOTOS} photos.`,
        ),
      );
    }
    if (accepted.length === 0) return;

    setBusy(true);
    onBusyChange?.(true);
    try {
      const added: ProcessedPhoto[] = [];
      for (const file of accepted) {
        let processed: ProcessedPhoto | null = null;
        try {
          // Images are compressed (EXIF dropped, WebP); clips go up as-is.
          // Either way the publish payload carries storage paths, not bytes.
          processed = await processListingMedia(file);
          added.push(await uploadProcessedPhoto(processed));
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
      if (added.length > 0) onChange([...photos, ...added]);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
      for (const ref of [galleryRef, cameraRef, filesRef, videoRef]) {
        if (ref.current) ref.current.value = '';
      }
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

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label mb-0">{resolvedLabel}</span>
        <span className="text-xs font-bold text-muted">
          {lang === 'en'
            ? `${photos.length} of ${MAX_PHOTOS}`
            : `${toPersianDigits(photos.length)} از ${toPersianDigits(MAX_PHOTOS)}`}
        </span>
      </div>

      <p className="hint mb-2">
        {t(
          'تصویر اول (کاور آگهی) باید عکس باشد؛ در اسلات‌های بعدی می‌توانید ویدیو (MP4، WebM یا MOV تا ۴۰ مگابایت) هم اضافه کنید. اطلاعات مخفی عکس (EXIF) حذف و همه عکس‌ها به WebP تبدیل می‌شوند.',
          'The first slot (listing cover) must be an image; later slots can also include video (MP4, WebM or MOV up to 40 MB). Hidden EXIF data is removed and images are converted to WebP.',
        )}
      </p>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li
            key={photo.previewUrl}
            className="relative aspect-[var(--photo-aspect)] overflow-hidden rounded-field border border-line bg-sunken"
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
                alt={t(
                  `پیش‌نمایش عکس ${toPersianDigits(index + 1)}`,
                  `Photo preview ${index + 1}`,
                )}
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
            <button
              type="button"
              onClick={() => removeAt(index)}
              aria-label={t(
                `حذف عکس ${toPersianDigits(index + 1)}`,
                `Remove photo ${index + 1}`,
              )}
              className="absolute bottom-1 end-1 flex h-7 w-7 items-center justify-center rounded-full bg-inverse/80 text-sm font-bold text-white backdrop-blur hover:bg-inverse"
            >
              ✕
            </button>
          </li>
        ))}

        <li>
          <button
            type="button"
            onClick={() => setChooserOpen(true)}
            disabled={remaining === 0 || busy}
            className="flex aspect-[var(--photo-aspect)] w-full flex-col items-center justify-center gap-1 rounded-field border border-dashed border-line-strong bg-card text-muted transition hover:border-cta hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Device-compatible source chooser: gallery, camera, files or video. */}
      {chooserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('افزودن عکس یا ویدیو', 'Add photo or video')}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          onClick={() => setChooserOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl border border-line bg-card p-3 shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-1 pb-2 text-xs font-extrabold text-muted">
              {t('افزودن از', 'Add from')}
            </p>
            {[
              {
                key: 'gallery',
                label: t('۱. انتخاب از گالری تصاویر', '1. Choose from photo library'),
                ref: galleryRef,
              },
              {
                key: 'camera',
                label: t('۲. گرفتن عکس با دوربین', '2. Take a photo with the camera'),
                ref: cameraRef,
              },
              {
                key: 'files',
                label: t('۳. انتخاب از فایل‌ها', '3. Choose from files'),
                ref: filesRef,
              },
              {
                key: 'video',
                label: t('۴. افزودن ویدیو (اسلات ۲ به بعد)', '4. Add video (slot 2 onwards)'),
                ref: videoRef,
              },
            ].map((source) => (
              <button
                key={source.key}
                type="button"
                onClick={() => {
                  setChooserOpen(false);
                  source.ref.current?.click();
                }}
                className="flex w-full items-center justify-between rounded-field px-3 py-3 text-start text-sm font-bold text-ink transition hover:bg-cta-soft"
              >
                {source.label}
                <span aria-hidden className="text-faint">
                  ‹
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setChooserOpen(false)}
              className="mt-1 w-full rounded-field border border-line py-2 text-xs font-bold text-muted"
            >
              {t('انصراف', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Gallery */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {/* Camera (rear lens on a phone) */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {/* Files (images and clips) */}
      <input
        ref={filesRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {/* Video only — slots 2+ (the cover must stay a still image) */}
      <input
        ref={videoRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {busy && (
        <p className="hint" role="status">
          {t('در حال پردازش و بارگذاری عکس‌ها…', 'Processing and uploading photos…')}
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
