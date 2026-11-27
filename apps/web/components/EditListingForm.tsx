'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  MAX_PHOTOS,
  aedToIRR,
  formatAmountLatin,
  irrToAED,
  irrToToman,
  toAsciiDigits,
  tomanToIRR,
} from '@alisales/schemas';
import { Icon } from './Icon';
import { PhotoUploader } from './PhotoUploader';
import { FormField } from './listing-form/FormField';
import { FormSection } from './listing-form/FormSection';
import { SegmentedControl } from './listing-form/SegmentedControl';
import { StickyPublishBar } from './listing-form/StickyPublishBar';
import { ToggleRow } from './listing-form/ToggleRow';
import type { ProcessedPhoto } from '@/lib/photos';
import type { OwnerPhotoMeta } from '@/lib/data/listings';
import { useI18n } from '@/lib/i18n';

type PriceUnit = 'toman' | 'aed';

function parseNumber(raw: string): number {
  const cleaned = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

/** Group while typing: «34000000000» → «34,000,000,000» (Latin digits). */
function groupAmount(raw: string): string {
  const digits = toAsciiDigits(raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return formatAmountLatin(Number(digits));
}

/**
 * Edit form (price, description, phone-reveal, photo set).
 *
 * It is the same workspace as `/new`: one centred `max-w-4xl` column on a 4px
 * rhythm, hairline-divided sections, paired fields on desktop, the one navy
 * segmented control for the price unit beside the price input, and the same
 * switches and photo grid. Only the values sent to `PATCH /api/listings/:id`
 * are editable — brand, model, year and plate stay server-owned.
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
  const { t, lang } = useI18n();
  const [unit, setUnit] = useState<PriceUnit>('toman');
  const [price, setPrice] = useState<string>(
    formatAmountLatin(irrToToman(priceIRR)),
  );
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
      setPrice(
        groupAmount(String(next === 'toman' ? irrToToman(irr) : irrToAED(irr))),
      );
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

  const saveLabel = saving
    ? t('در حال ذخیره…', 'Saving…')
    : photosBusy
      ? t('در حال بارگذاری عکس‌ها…', 'Uploading photos…')
      : t('ذخیره تغییرات', 'Save changes');

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="listing-entry mx-auto w-full max-w-4xl pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      <header>
        <p className="text-sm font-extrabold leading-6 text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          {t(
            'برند، مدل، سال ساخت و وضعیت پلاک پس از ثبت قابل ویرایش نیستند.',
            'Brand, model, model year and plate status cannot be edited after publishing.',
          )}
        </p>
      </header>

      {error && (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/60 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          <Icon name="alertCircle" size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && (
        <p
          className="mt-4 rounded-xl border border-line bg-cta-soft px-4 py-3 text-sm font-bold text-ink"
          role="status"
        >
          {t('تغییرات ذخیره شد.', 'Changes saved.')}
        </p>
      )}

      <div className="mt-8 space-y-8">
        <FormSection title={t('قیمت و تماس', 'Price and contact')}>
          <FormField
            htmlFor="price"
            label={t(
              `قیمت (${unit === 'toman' ? 'تومان' : 'درهم'})`,
              `Price (${unit === 'toman' ? 'Toman' : 'AED'})`,
            )}
            required
            hint={
              irrPreview !== null
                ? t(
                    `معادل ${formatAmountLatin(irrToToman(irrPreview))} تومان در فهرست`,
                    `Equivalent to ${formatAmountLatin(irrToToman(irrPreview))} Toman in listings`,
                  )
                : t(
                    'قیمت در فهرست به تومان نمایش داده می‌شود.',
                    'The listing price is displayed in Toman.',
                  )
            }
          >
            <div className="flex items-stretch gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="price"
                  inputMode="numeric"
                  autoComplete="off"
                  className="field pe-11 text-end"
                  value={price}
                  onChange={(e) => setPrice(groupAmount(e.target.value))}
                  placeholder={
                    unit === 'toman'
                      ? t('مثلاً 1,100,000,000', 'e.g. 1,100,000,000')
                      : t('مثلاً 40,000', 'e.g. 40,000')
                  }
                  dir="ltr"
                />
                {price && (
                  <button
                    type="button"
                    onClick={() => setPrice('')}
                    aria-label={t('پاک کردن قیمت', 'Clear price')}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
              {/* Same control as `/new`: the unit sits beside the field, never
                  as a chip embedded in it. */}
              <SegmentedControl
                className="w-[128px] shrink-0"
                size="sm"
                ariaLabel={t('واحد قیمت', 'Price currency')}
                options={[
                  { value: 'toman', label: t('تومان', 'Toman') },
                  { value: 'aed', label: t('درهم', 'AED') },
                ]}
                value={unit}
                onChange={(next) => switchUnit(next as PriceUnit)}
              />
            </div>
          </FormField>

          <ToggleRow
            className="col-span-full"
            label={t(
              'عدم نمایش قیمت درهم در آگهی (فقط نمایش قیمت به تومان)',
              'Hide the AED price on this listing (Toman only)',
            )}
            hint={t(
              'خط «≈ … AED» روی کارت، فهرست و صفحه‌ی آگهی نمایش داده نمی‌شود.',
              'The “≈ … AED” line is hidden on cards, feeds and the listing page.',
            )}
            checked={tomanOnly}
            onChange={setTomanOnly}
          />

          <ToggleRow
            className="col-span-full"
            label={t(
              'شماره تماس من در آگهی نمایش داده شود',
              'Show my phone number on this listing',
            )}
            hint={t(
              'در غیر این صورت خریداران فقط از طریق پیام‌رسان داخلی تماس می‌گیرند.',
              'Otherwise buyers can only reach you through in-app chat.',
            )}
            checked={showPhone}
            onChange={setShowPhone}
          />
        </FormSection>

        <FormSection title={t('توضیحات', 'Description')} columns="one">
          <FormField
            htmlFor="description"
            label={t('توضیحات آگهی (اختیاری)', 'Listing description (optional)')}
            hint={t(
              `اختیاری است و حداقل نویسه ندارد — اکنون ${text.trim().length} نویسه`,
              `Optional with no minimum — currently ${text.trim().length} characters`,
            )}
          >
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
          </FormField>
        </FormSection>

        <FormSection
          title={t('عکس‌های آگهی', 'Listing photos')}
          hint={t(
            'ترتیب عکس‌ها همان ترتیب نمایش است؛ عکس اول کاور آگهی می‌شود.',
            'Photos appear in this order; the first photo is the listing cover.',
          )}
          meta={
            lang === 'en'
              ? `${photos.length} of ${MAX_PHOTOS}`
              : `${photos.length} از ${MAX_PHOTOS}`
          }
        >
          <div className="col-span-full">
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              onBusyChange={setPhotosBusy}
              showCounter={false}
            />
          </div>
        </FormSection>
      </div>

      {/* Desktop: cancel and save at the end of the form. */}
      <div className="mt-8 hidden items-center justify-between gap-3 lg:flex">
        <button type="button" onClick={() => router.back()} className="btn-ghost text-sm">
          {t('انصراف', 'Cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || photosBusy}
          className="btn-cta max-w-[280px] text-sm disabled:opacity-60"
        >
          {saveLabel}
        </button>
      </div>

      {/* Phone/tablet: the same sticky save bar as `/new`. */}
      <StickyPublishBar label={saveLabel} disabled={saving || photosBusy} />
    </form>
  );
}
