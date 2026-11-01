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
  photos: existing,
}: {
  id: string;
  slug: string;
  title: string;
  priceIRR: number;
  description: string;
  allowPhoneReveal: boolean;
  photos: OwnerPhotoMeta[];
}) {
  const router = useRouter();
  const [unit, setUnit] = useState<PriceUnit>('toman');
  const [price, setPrice] = useState<string>(String(irrToToman(priceIRR)));
  const [text, setText] = useState(description);
  const [showPhone, setShowPhone] = useState(allowPhoneReveal);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>(() =>
    existing.map((photo) => ({
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
      setError('قیمت را به عدد وارد کنید.');
      return;
    }
    if (text.trim().length < 10) {
      setError('توضیحات باید دست‌کم ۱۰ نویسه باشد.');
      return;
    }
    if (photos.length === 0) {
      setError('حداقل یک عکس برای آگهی لازم است.');
      return;
    }
    if (photos.some((p) => !p.path)) {
      setError('عکس‌ها هنوز بارگذاری نشده‌اند؛ چند لحظه صبر کنید.');
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
        setError(body?.error ?? body?.issues?.[0]?.message ?? 'ذخیره تغییرات انجام نشد.');
        return;
      }
      setSaved(true);
      router.refresh();
      router.push(`/listing/${slug}`);
    } catch {
      setError('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.');
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
          برند، مدل، سال ساخت و وضعیت پلاک پس از ثبت قابل ویرایش نیستند.
        </p>
      </section>

      {error && (
        <div className="rounded-field border border-[var(--color-danger-fg)] bg-bad-soft px-4 py-3 text-sm font-bold text-bad" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <p className="rounded-field border border-line bg-cta-soft px-4 py-3 text-sm font-bold" role="status">
          تغییرات ذخیره شد.
        </p>
      )}

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">قیمت و تماس</h2>

        <div className="mb-2 flex items-center gap-2" role="group" aria-label="واحد قیمت">
          {(
            [
              { key: 'toman', label: 'تومان' },
              { key: 'aed', label: 'درهم (AED)' },
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
          قیمت ({unit === 'toman' ? 'تومان' : 'درهم'})
        </label>
        <input
          id="price"
          inputMode="numeric"
          className="field"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={unit === 'toman' ? 'مثلاً ۱٬۱۰۰٬۰۰۰٬۰۰۰' : 'مثلاً ۴۰٬۰۰۰'}
        />
        <p className="hint">
          {irrPreview !== null
            ? `معادل ${groupDigits(irrPreview)} ریال`
            : 'قیمت ذخیره‌شده همیشه به ریال است.'}
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={showPhone}
            onChange={(e) => setShowPhone(e.target.checked)}
            className="mt-1 accent-[var(--color-accent)]"
          />
          <span>
            شماره تماس من در آگهی نمایش داده شود
            <span className="hint mt-0 block">
              در غیر این صورت خریداران فقط از طریق پیام‌رسان داخلی تماس می‌گیرند.
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">توضیحات</h2>
        <label className="label" htmlFor="description">
          توضیحات آگهی
        </label>
        <textarea
          id="description"
          rows={5}
          className="field resize-y"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="وضعیت فنی، دلیل فروش، لوازم همراه…"
        />
        <p className="hint">دست‌کم ۱۰ نویسه — اکنون {toPersianDigits(text.trim().length)} نویسه</p>
      </section>

      <section className="rounded-card border border-line bg-card p-4 sm:p-5">
        <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">عکس‌های آگهی</h2>
        <PhotoUploader
          photos={photos}
          onChange={setPhotos}
          onBusyChange={setPhotosBusy}
          label="عکس‌های آگهی"
        />
        <p className="hint mt-2">ترتیب عکس‌ها همان ترتیب نمایش است؛ عکس اول کاور آگهی می‌شود.</p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => router.back()} className="btn-ghost text-sm">
          انصراف
        </button>
        <button
          type="submit"
          disabled={saving || photosBusy}
          className="btn-cta text-sm disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره…' : photosBusy ? 'در حال بارگذاری عکس‌ها…' : 'ذخیره تغییرات'}
        </button>
      </div>
    </form>
  );
}
