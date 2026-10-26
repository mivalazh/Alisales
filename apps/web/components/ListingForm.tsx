'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  BRANDS,
  selectableCities,
  COLOR_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  LISTING_FIELD_LABELS,
  MAX_VEHICLE_YEAR,
  MIN_VEHICLE_YEAR,
  PLATE_DECLARATION_FOOTER,
  PLATE_TYPE_LABELS,
  colorSlugs,
  conditions,
  fuelTypes,
  gearboxTypes,
  formatIRR,
  listingPublishSchema,
  plateStatement,
  plateTypes,
  toAsciiDigits,
  toPersianDigits,
  type ListingPublish,
  type PlateType,
} from '@alisales/schemas';
import { PhotoUploader } from './PhotoUploader';
import type { ProcessedPhoto } from '@/lib/photos';

/** Human labels for schema paths — shared with the mobile form. */
const FIELD_LABELS: Record<string, string> = LISTING_FIELD_LABELS;

const INITIAL_DRAFT = {
  brand: 'saipa',
  model: '',
  trim: '',
  year: '',
  mileageKm: '',
  gearbox: '',
  fuel: 'petrol',
  color: 'white',
  condition: '',
  plateType: '',
  vin: '',
  priceIRR: '',
  city: 'kish',
  description: '',
  allowPhoneReveal: false,
};

type Draft = typeof INITIAL_DRAFT;

function Field({
  htmlFor,
  label,
  hint,
  error,
  children,
  className = '',
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="error-text" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="hint">{hint}</p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <h2 className="mb-4 border-b border-line pb-2 text-md font-extrabold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function parseIntLoose(raw: string): number {
  const cleaned = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

export function ListingForm() {
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);

  const photosRef = useRef<ProcessedPhoto[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  // Revoke preview object URLs when the form unmounts.
  useEffect(
    () => () => {
      photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    },
    [],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const activeBrand = BRANDS.find((b) => b.slug === draft.brand) ?? BRANDS[0]!;
  const plateStatementText = draft.plateType
    ? plateStatement(draft.plateType as PlateType)
    : null;
  const pricePreview = (() => {
    const n = parseIntLoose(draft.priceIRR);
    return Number.isFinite(n) && n > 0 ? formatIRR(n) : null;
  })();

  function buildPayload(): ListingPublish {
    return {
      vehicle: {
        brand: draft.brand as ListingPublish['vehicle']['brand'],
        model: draft.model.trim(),
        trim: draft.trim.trim() || null,
        year: parseIntLoose(draft.year),
        mileageKm: parseIntLoose(draft.mileageKm),
        gearbox: draft.gearbox as ListingPublish['vehicle']['gearbox'],
        fuel: draft.fuel as ListingPublish['vehicle']['fuel'],
        color: draft.color as ListingPublish['vehicle']['color'],
        condition: draft.condition as ListingPublish['vehicle']['condition'],
        plateType: draft.plateType as PlateType,
        vin: draft.vin.trim() ? draft.vin.trim().toUpperCase() : null,
      },
      priceIRR: parseIntLoose(draft.priceIRR),
      city: draft.city,
      description: draft.description.trim(),
      photos: photos.map((p, i) => ({
        path: `pending/${Date.now().toString(36)}-${i}.webp`,
        mime: 'image/webp' as const,
        bytes: p.bytes,
        width: p.width,
        height: p.height,
        position: i,
      })),
      showroomId: null,
      allowPhoneReveal: draft.allowPhoneReveal,
    };
  }

  function applyIssues(issues: { path: string; message: string }[]): void {
    const errs: Record<string, string> = {};
    for (const issue of issues) {
      if (errs[issue.path]) continue;
      const label =
        FIELD_LABELS[issue.path] ?? FIELD_LABELS[issue.path.split('.')[0] ?? ''] ?? null;
      errs[issue.path] = label ? `${label} — ${issue.message}` : issue.message;
    }
    setFieldErrors(errs);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || photosBusy) return;
    setFormError(null);
    setFieldErrors({});

    const parsed = listingPublishSchema.safeParse(buildPayload());
    if (!parsed.success) {
      applyIssues(
        parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      );
      setFormError('لطفاً خطاهای مشخص‌شده را برطرف کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        slug?: string;
        error?: string;
        issues?: { path: string; message: string }[];
      } | null;

      if (res.status === 201 && body?.slug) {
        setSuccessSlug(body.slug);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (res.status === 400 && body?.issues) {
        applyIssues(body.issues);
        setFormError('اطلاعات ارسالی معتبر نیست.');
        return;
      }
      setFormError(
        body?.error ?? 'ارسال آگهی ناموفق بود؛ لطفاً دوباره تلاش کنید.',
      );
    } catch {
      setFormError('ارتباط با سرور برقرار نشد؛ اتصال اینترنت خود را بررسی کنید.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm(): void {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    setDraft(INITIAL_DRAFT);
    setFieldErrors({});
    setFormError(null);
    setSuccessSlug(null);
  }

  if (successSlug) {
    return (
      <div
        className="mx-auto max-w-3xl rounded-card border border-line bg-card px-6 py-10 text-center"
        role="status"
      >
        <p className="text-lg font-extrabold">آگهی شما با موفقیت ثبت شد</p>
        <p className="mt-1 text-sm text-muted">
          آگهی در انتظار بررسی است و پس از تأیید، در فهرست نمایش داده می‌شود.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href="/" className="btn-cta text-sm">
            مشاهده فهرست آگهی‌ها
          </a>
          <button type="button" onClick={resetForm} className="btn-ghost text-sm">
            ثبت آگهی دیگر
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} noValidate className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold">ثبت آگهی خودرو</h1>
        <p className="mt-1 text-sm text-muted">
          اطلاعات را دقیق وارد کنید؛ آگهی پس از ثبت، در انتظار بررسی قرار می‌گیرد.
        </p>
      </div>

      {formError && (
        <div
          className="rounded-field border border-[var(--color-danger-fg)] bg-bad-soft px-4 py-3 text-sm font-bold text-bad"
          role="alert"
        >
          {formError}
        </div>
      )}

      <Section title="مشخصات خودرو">
        <Field htmlFor="brand" label="برند" error={fieldErrors['vehicle.brand']}>
          <select
            id="brand"
            className="field"
            value={draft.brand}
            onChange={(e) => set('brand', e.target.value)}
          >
            {BRANDS.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          htmlFor="model"
          label="مدل"
          hint="می‌توانید از فهرست پیشنهادی انتخاب کنید یا مدل دیگری بنویسید."
          error={fieldErrors['vehicle.model']}
        >
          <input
            id="model"
            list="model-options"
            className="field"
            value={draft.model}
            onChange={(e) => set('model', e.target.value)}
            placeholder="مثلاً پژو ۲۰۶"
          />
          <datalist id="model-options">
            {activeBrand.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </Field>

        <Field htmlFor="trim" label="تیپ (اختیاری)" error={fieldErrors['vehicle.trim']}>
          <input
            id="trim"
            className="field"
            value={draft.trim}
            onChange={(e) => set('trim', e.target.value)}
            placeholder="مثلاً S یا LX"
          />
        </Field>

        <Field
          htmlFor="year"
          label="سال ساخت (شمسی)"
          hint={`بین ${toPersianDigits(MIN_VEHICLE_YEAR)} و ${toPersianDigits(MAX_VEHICLE_YEAR)}`}
          error={fieldErrors['vehicle.year']}
        >
          <input
            id="year"
            inputMode="numeric"
            className="field"
            value={draft.year}
            onChange={(e) => set('year', e.target.value)}
            placeholder="مثلاً ۱۴۰۲"
          />
        </Field>

        <Field
          htmlFor="mileageKm"
          label="کارکرد (کیلومتر)"
          hint="عدد صحیح؛ خودروی صفر کیلومتر: ۰"
          error={fieldErrors['vehicle.mileageKm']}
        >
          <input
            id="mileageKm"
            inputMode="numeric"
            className="field"
            value={draft.mileageKm}
            onChange={(e) => set('mileageKm', e.target.value)}
            placeholder="مثلاً ۵۸۰۰۰"
          />
        </Field>

        <Field htmlFor="gearbox" label="گیربکس" error={fieldErrors['vehicle.gearbox']}>
          <select
            id="gearbox"
            className="field"
            value={draft.gearbox}
            onChange={(e) => set('gearbox', e.target.value)}
          >
            <option value="">انتخاب کنید…</option>
            {gearboxTypes.map((g) => (
              <option key={g} value={g}>
                {GEARBOX_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="fuel" label="سوخت" error={fieldErrors['vehicle.fuel']}>
          <select
            id="fuel"
            className="field"
            value={draft.fuel}
            onChange={(e) => set('fuel', e.target.value)}
          >
            {fuelTypes.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="color" label="رنگ" error={fieldErrors['vehicle.color']}>
          <select
            id="color"
            className="field"
            value={draft.color}
            onChange={(e) => set('color', e.target.value)}
          >
            {colorSlugs.map((c) => (
              <option key={c} value={c}>
                {COLOR_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="condition" label="وضعیت خودرو" error={fieldErrors['vehicle.condition']}>
          <select
            id="condition"
            className="field"
            value={draft.condition}
            onChange={(e) => set('condition', e.target.value)}
          >
            <option value="">انتخاب کنید…</option>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c === 'new' ? 'نو' : 'کارکرده'}
              </option>
            ))}
          </select>
        </Field>

        <Field
          htmlFor="vin"
          label="شماره شاسی (VIN) — اختیاری"
          hint="۱۷ کاراکتر؛ فقط حروف و ارقام انگلیسی"
          error={fieldErrors['vehicle.vin']}
        >
          <input
            id="vin"
            className="field font-mono"
            dir="ltr"
            value={draft.vin}
            onChange={(e) => set('vin', e.target.value)}
            placeholder="VF3XXXXXXXXXXXXXX"
          />
        </Field>
      </Section>

      {/* Dedicated seller-declared plate section — spec §4: no forced police notice. */}
      <Section title="وضعیت پلاک">
        <div className="col-span-full grid gap-2 sm:grid-cols-4">
          {plateTypes.map((pt) => (
            <label
              key={pt}
              className={`flex cursor-pointer items-center gap-2 rounded-field border p-3 text-sm font-bold transition ${
                draft.plateType === pt
                  ? 'border-cta bg-cta-soft text-ink'
                  : 'border-line bg-card text-muted hover:border-line-strong'
              }`}
            >
              <input
                type="radio"
                name="plateType"
                value={pt}
                checked={draft.plateType === pt}
                onChange={(e) => set('plateType', e.target.value)}
                className="accent-[var(--color-accent)]"
              />
              {PLATE_TYPE_LABELS[pt]}
            </label>
          ))}
        </div>
        {fieldErrors['vehicle.plateType'] && (
          <p className="error-text col-span-full" role="alert">
            {fieldErrors['vehicle.plateType']}
          </p>
        )}
        {plateStatementText && (
          <div className="col-span-full rounded-field border border-line bg-page p-3 text-sm">
            <p className="font-bold">{plateStatementText}</p>
            <p className="mt-1 text-xs text-muted">{PLATE_DECLARATION_FOOTER}</p>
          </div>
        )}
      </Section>

      <Section title="قیمت، شهر و تماس">
        <Field
          htmlFor="priceIRR"
          label="قیمت (ریال)"
          hint={pricePreview ? `معادل: ${pricePreview}` : 'ارقام فارسی یا انگلیسی مجاز است'}
          error={fieldErrors['priceIRR']}
        >
          <input
            id="priceIRR"
            inputMode="numeric"
            className="field"
            value={draft.priceIRR}
            onChange={(e) => set('priceIRR', e.target.value)}
            placeholder="مثلاً ۱٬۱۰۰٬۰۰۰٬۰۰۰٬۰۰۰"
          />
        </Field>

        <Field htmlFor="city" label="شهر" error={fieldErrors['city']}>
          <select
            id="city"
            className="field"
            value={draft.city}
            onChange={(e) => set('city', e.target.value)}
          >
            {selectableCities().map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="col-span-full flex cursor-pointer items-start gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.allowPhoneReveal}
            onChange={(e) => set('allowPhoneReveal', e.target.checked)}
            className="mt-1 accent-[var(--color-accent)]"
          />
          <span>
            شماره تماس من در آگهی نمایش داده شود
            <span className="hint mt-0 block">
              در غیر این صورت، خریداران فقط از طریق پیام‌رسان داخلی با شما تماس می‌گیرند.
            </span>
          </span>
        </label>
      </Section>

      <Section title="توضیحات">
        <Field
          className="col-span-full"
          htmlFor="description"
          label="توضیحات آگهی"
          hint={`دست‌کم ${toPersianDigits(20)} نویسه — اکنون ${toPersianDigits(draft.description.trim().length)} نویسه`}
          error={fieldErrors['description']}
        >
          <textarea
            id="description"
            rows={5}
            className="field resize-y"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="وضعیت فنی، دلیل فروش، لوازم همراه خودرو…"
          />
        </Field>
      </Section>

      <Section title="عکس‌های آگهی">
        <div className="col-span-full">
          <PhotoUploader
            photos={photos}
            onChange={setPhotos}
            onBusyChange={setPhotosBusy}
            error={fieldErrors['photos']}
          />
        </div>
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          با ثبت آگهی، صحت اطلاعات و وضعیت پلاک را تأیید می‌کنید.
        </p>
        <button
          type="submit"
          disabled={submitting || photosBusy}
          className="btn-cta text-sm disabled:opacity-60"
        >
          {submitting
            ? 'در حال ارسال…'
            : photosBusy
              ? 'در حال پردازش عکس‌ها…'
              : 'انتشار آگهی'}
        </button>
      </div>
    </form>
  );
}
