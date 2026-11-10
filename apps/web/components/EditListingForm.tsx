'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  aedToIRR,
  groupDigits,
  irrToAED,
  irrToToman,
  toAsciiDigits,
  tomanToIRR,
  toPersianDigits,
} from '@alisales/schemas';
import { PhotoUploader } from './PhotoUploader';
import type { ProcessedPhoto } from '@/lib/photos';
import type { OwnerPhotoMeta } from '@/lib/data/listings';
import { useI18n } from '@/lib/i18n';

type PriceUnit = 'toman' | 'aed';

function parseNumber(raw: string): number {
  const cleaned = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

/**
 * Edit form (price, description, phone-reveal, photo set).
 *
 * The price field accepts Toman or AED entry and always submits IRR — the unit
 * switch is an entry convenience, not a currency transaction. Photos keep their
 * order: the first item is the cover, «کاور شود» moves a photo to position 0.
 */
export function EditListingForm({
  id,
  slug,
  title,
  priceIRR,
  description,
  allowPhoneReveal,
  hideAed = false,
  photos: existing,
}: {
  id: string;
  slug: string;
  title: string;
  priceIRR: number;
  description: string;
  allowPhoneReveal: boolean;
  /** Current «فقط تومان» preference. */
  hideAed?: boolean;
  photos: OwnerPhotoMeta[];
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [unit, setUnit] = useState<PriceUnit>('toman');
  const [price, setPrice] = useState<string>(String(irrToToman(priceIRR)));
  const [text, setText] = useState(description);
  const [showPhone, setShowPhone] = useState(allowPhoneReveal);
  const [tomanOnly, setTomanOnly] = useState(hideAed);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>(() =>
    existing.map((photo) => ({
      kind: 'image' as const,
      mime: 'image/webp' as const,
      blob: null,
      previewUrl: photo.url,
      url: photo.url,
      path: photo.path,
      width: photo.width,
      height: photo.height,
      bytes: photo.bytes,
    })),
  );
  const [photosBusy, setPhotosBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const photosRef = useRef<ProcessedPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => {
        if (p.blob) URL.revokeObjectURL(p.previewUrl);
      });
    },
    [],
  );

  function irrFor(value: number, forUnit: PriceUnit): number {
    return forUnit === 'toman' ? tomanToIRR(value) : aedToIRR(value);
  }

  function switchUnit(next: PriceUnit): void {
    if (next === unit) return;
    const current = parseNumber(price);
    if (Number.isFinite(current)) {
      const irr = irrFor(current, unit);
      setPrice(String(next === 'toman' ? irrToToman(irr) : irrToAED(irr)));
    }
    setUnit(next);
  }

  const parsedPrice = parseNumber(price);
  const irrPreview = Number.isFinite(parsedPrice) ? irrFor(parsedPrice, unit) : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || photosBusy) return;
    setError(null);
    setSaved(false);

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError(t('قیمت را به عدد وارد کنید.', 'Enter the price as a number.'));
      return;
    }
    if (photos.some((p) => !p.path)) {
      setError(
        t('عکس‌ها هنوز بارگذاری نشده‌اند؛ چند لحظه صبر کنید.', 'Photos are still uploading; please wait.'),
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          priceIRR: irrFor(parsedPrice, unit),
          description: text.trim(),
          allowPhoneReveal: showPhone,
          hideAed: tomanOnly,
          photos: photos.map((photo, index) => ({
            path: photo.path as string,
            mime: 'image/webp',
            bytes: Math.max(1, photo.bytes),
            width: Math.max(1, photo.width),
            height: Math.max(1, photo.height),
            position: index,
          })),
        }),
      });
      if (res.status === 401) {
        router.push(`/login?next=/edit/${id}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        issues?: { message: string }[];
      } | null;
      if (!res.ok) {
        setError(
          body?.error ??
            body?.issues?.[0]?.message ??
            t('ذخیره تغییرات انجام نشد.', 'Could not save your changes.'),
        );
        return;
      }
      setSaved(true);
      router.refresh();
      router.push(`/listing/${slug}`);
    } catch {
      setError(t('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.', 'Could not reach the server; try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-1 border-b border-line pb-2 text-md font-extrabold">{title}</h2>
        <p className="mt-2 text-xs text-muted">
          {t(
            'برند، مدل، سال ساخت و وضعیت پلاک پس از ثبت قابل ویرایش نیستند.',
            'Brand, model, model year and plate status cannot be edited after publishing.',
          )}
        </p>
      </section>

      {error && (
        <div className="rounded-field border border-[var(--color-danger-fg)] bg-bad-soft px-4 py-3 text-sm font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <p className="rounded-field border border-line bg-cta-soft px-4 py-3 text-sm font-bold" role="status">
          {t('تغییرات ذخیره شد.', 'Changes saved.')}
        </p>
      )}

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">
          {t('قیمت و تماس', 'Price and contact')}
        </h2>

        <div
          className="mb-2 flex items-center gap-2"
          role="group"
          aria-label={t('واحد قیمت', 'Price currency')}
        >
          {(
            [
              { key: 'toman', label: t('تومان', 'Toman') },
              { key: 'aed', label: t('درهم (AED)', 'AED') },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={unit === option.key}
              onClick={() => switchUnit(option.key)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-extrabold transition ${
                unit === option.key
                  ? 'border-cta bg-cta-soft text-ink'
                  : 'border-line bg-card text-muted hover:border-line-strong'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <label className="label" htmlFor="price">
          {t(
            `قیمت (${unit === 'toman' ? 'تومان' : 'درهم'})`,
            `Price (${unit === 'toman' ? 'Toman' : 'AED'})`,
          )}
        </label>
        <input
          id="price"
          inputMode="numeric"
          className="field"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={
            unit === 'toman'
              ? t('مثلاً ۱٬۱۰۰٬۰۰۰٬۰۰۰', 'e.g. 1,100,000,000')
              : t('مثلاً ۴۰٬۰۰۰', 'e.g. 40,000')
          }
        />
        <p className="hint">
          {irrPreview !== null
            ? t(
                `معادل ${groupDigits(irrToToman(irrPreview))} تومان در فهرست`,
                `Equivalent to ${groupDigits(irrToToman(irrPreview))} Toman in listings`,
              )
            : t(
                'قیمت در فهرست به تومان نمایش داده می‌شود.',
                'The listing price is displayed in Toman.',
              )}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={tomanOnly}
            onChange={(e) => setTomanOnly(e.target.checked)}
            className="mt-1 accent-[var(--color-accent)]"
          />
          <span>
            {t(
              'عدم نمایش قیمت درهم در آگهی (فقط نمایش قیمت به تومان)',
              'Hide the AED price on this listing (Toman only)',
            )}
            <span className="hint mt-0 block">
              {t(
                'خط «≈ … AED» روی کارت، فهرست و صفحه‌ی آگهی نمایش داده نمی‌شود.',
                'The “≈ … AED” line is hidden on cards, feeds and the listing page.',
              )}
            </span>
          </span>
        </label>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
            className="mt-1 accent-[var(--color-accent)]"
          />
          <span>
            {t(
              'شماره تماس من در آگهی نمایش داده شود',
              'Show my phone number on this listing',
            )}
            <span className="hint mt-0 block">
              {t(
                'در غیر این صورت خریداران فقط از طریق پیام‌رسان داخلی تماس می‌گیرند.',
                'Otherwise buyers can only reach you through in-app chat.',
              )}
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">
          {t('توضیحات', 'Description')}
        </h2>
        <label className="label" htmlFor="description">
          {t('توضیحات آگهی (اختیاری)', 'Listing description (optional)')}
        </label>
        <textarea
          id="description"
          rows={5}
          className="field resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(
            'وضعیت فنی، دلیل فروش، لوازم همراه…',
            'Mechanical condition, reason for selling, included accessories…',
          )}
        />
        <p className="hint">
          {t(
            `اختیاری است و حداقل نویسه ندارد — اکنون ${toPersianDigits(text.trim().length)} نویسه`,
            `Optional with no minimum — currently ${text.trim().length} characters`,
          )}
        </p>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">
          {t('عکس‌های آگهی', 'Listing photos')}
        </h2>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          onBusyChange={setPhotosBusy}
          label={t('عکس‌های آگهی', 'Listing photos')}
        />
        <p className="hint mt-2">
          {t(
            'ترتیب عکس‌ها همان ترتیب نمایش است؛ عکس اول کاور آگهی می‌شود.',
            'Photos appear in this order; the first photo is the listing cover.',
          )}
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => router.back()} className="btn-ghost text-sm">
          {t('انصراف', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || photosBusy}
          className="btn-cta text-sm disabled:opacity-60"
        >
          {saving
            ? t('در حال ذخیره…', 'Saving…')
            : photosBusy
              ? t('در حال بارگذاری عکس‌ها…', 'Uploading photos…')
              : t('ذخیره تغییرات', 'Save changes')}
        </button>
      </div>
    </form>
  );
}
