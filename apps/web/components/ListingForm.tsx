'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  BIKE_TYPES,
  DEFAULT_AED_TO_IRR,
  HEAVY_TYPES,
  VEHICLE_YEARS,
  gregorianToJalaliYear,
  VEHICLE_CATEGORY_LABELS,
  brandsForCategory,
  COLOR_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  LISTING_FIELD_LABELS,
  PART_CATEGORY_LABELS,
  PART_CONDITION_LABELS,
  PART_FIELD_LABELS,
  PART_ORIGIN_LABELS,
  PLATE_DECLARATION_FOOTER,
  PLATE_TYPE_LABELS,
  aedToIRR,
  colorSlugs,
  conditions,
  fuelTypes,
  gearboxTypes,
  formatAmountLatin,
  irrToAED,
  irrToToman,
  listingPublishSchema,
  partCategories,
  partConditions,
  partListingPublishSchema,
  partOrigins,
  plateStatement,
  plateTypes,
  selectableCities,
  toAsciiDigits,
  toPersianDigits,
  tomanInWords,
  tomanToIRR,
  type ListingPublish,
  type PlateType,
  type VehicleCategory,
  type VehicleInput,
} from '@alisales/schemas';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { PhotoUploader } from './PhotoUploader';
import { RateLine } from './RateLine';
import { useAedRate } from './RateProvider';
import type { ProcessedPhoto } from '@/lib/photos';

/** Human labels for schema paths — shared with the mobile form. */
const FIELD_LABELS: Record<string, string> = { ...LISTING_FIELD_LABELS, ...PART_FIELD_LABELS };

const INITIAL_DRAFT = {
  brand: 'toyota',
  /** Free-typed brand when no catalogue marque matches. */
  customBrand: '',
  model: '',
  trim: '',
  year: '',
  mileageKm: '',
  gearbox: 'automatic',
  fuel: 'petrol',
  color: 'white',
  condition: '',
  plateType: '',
  vin: '',
  priceIRR: '',
  city: 'kish',
  description: '',
  allowPhoneReveal: false,
  /** «عدم نمایش قیمت درهم در آگهی» — Toman-only price. */
  hideAed: false,
  /** Motorcycle / heavy only. */
  engineCc: '',
  bikeType: '',
  heavyType: '',
  workingHours: '',
};

type PriceUnit = 'toman' | 'aed';

type Draft = typeof INITIAL_DRAFT;

const INITIAL_PART_DRAFT = {
  category: '',
  title: '',
  partNumber: '',
  compatibility: '',
  origin: '',
  condition: '',
  warranty: '',
};

type PartDraft = typeof INITIAL_PART_DRAFT;
type ListingMode = 'vehicle' | 'part';

const CATEGORY_OPTIONS: ReadonlyArray<{ key: VehicleCategory; label: string; hint: string }> = [
  { key: 'car', label: 'خودرو', hint: 'سواری، شاسی‌بلند و وارداتی' },
  { key: 'motorcycle', label: 'موتور و اسکوتر برقی', hint: 'اسکوتر و موتور برقی، اسپرت و کلاسیک' },
  { key: 'heavy', label: 'ماشین‌آلات سنگین', hint: 'کامیون، کشنده و راه‌سازی' },
];

/** The step-2 spec card is named after the category actually being filled. */
const SPEC_TITLE: Record<VehicleCategory, string> = {
  car: 'مشخصات خودرو',
  motorcycle: 'مشخصات موتور و اسکوتر',
  heavy: 'مشخصات ماشین‌آلات سنگین',
};

function Field({
  htmlFor,
  label,
  hint,
  error,
  required = false,
  children,
  className = '',
}: {
  htmlFor?: string;
  label: string;
  hint?: string;
  error?: string;
  /** Required fields carry a red asterisk next to their label. */
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`${className} ${error ? 'field-invalid' : ''}`.trim()}>
      <label className="label" htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-red-600">
            *
          </span>
        )}
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

/** One of the three boxed steps, with its «مرحله n از 3» progress header. */
function StepCard({
  step,
  title,
  children,
}: {
  step: 1 | 2 | 3;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
        <h2 className="text-md font-extrabold text-ink">{title}</h2>
        <span className="rounded-[var(--radius-pill)] bg-cta-soft px-3 py-1 text-xs font-extrabold text-ink">
          مرحله {step} از 3
        </span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function parseIntLoose(raw: string): number {
  const cleaned = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  return cleaned === '' ? Number.NaN : Number(cleaned);
}

/**
 * Group a typed amount while the seller types: «54400000000» → «54,400,000,000».
 *
 * The field keeps its separators, the payload strips them, so a long price can
 * be counted by eye instead of by re-reading a run of eleven digits.
 */
function groupTypedAmount(raw: string): string {
  const digits = toAsciiDigits(raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return formatAmountLatin(Number(digits));
}

/**
 * Searchable brand combobox.
 *
 * Shows the category's full suggestion list, filters as the seller types, and
 * offers the typed text as a custom brand («سایر») — the exact same behaviour
 * the model field has, for every category.
 */
function BrandPicker({
  category,
  value,
  custom,
  onPick,
}: {
  category: VehicleCategory;
  value: string;
  custom: string;
  onPick: (slug: string, customName: string) => void;
}) {
  const brands = useMemo(() => brandsForCategory(category), [category]);
  const selected = brands.find((brand) => brand.slug === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const q = query.trim().toLowerCase();
  const options = q
    ? brands.filter(
        (brand) =>
          brand.label.toLowerCase().includes(q) ||
          brand.latin.toLowerCase().includes(q) ||
          brand.models.some((m) => m.toLowerCase().includes(q)),
      )
    : brands;

  return (
    <div ref={root} className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="brand-options"
        autoComplete="off"
        className="field"
        value={open ? query : (selected?.label ?? (custom ? `${custom} (دلخواه)` : ''))}
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder="جستجوی برند…"
      />

      {open && (
        <ul
          id="brand-options"
          role="listbox"
          className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-field border border-line bg-card p-1 shadow-xl"
        >
          {options.slice(0, 60).map((brand) => (
            <li key={brand.slug} role="option" aria-selected={brand.slug === value}>
              <button
                type="button"
                onClick={() => {
                  onPick(brand.slug, '');
                  setOpen(false);
                  setQuery('');
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-field px-2 py-1.5 text-sm font-semibold transition hover:bg-cta-soft ${
                  brand.slug === value ? 'bg-cta-soft text-ink' : 'text-muted'
                }`}
              >
                <span>{brand.label}</span>
                <span dir="ltr" className="text-[11px] font-bold text-faint">
                  {brand.latin}
                </span>
              </button>
            </li>
          ))}
          {query.trim() && options.length === 0 && (
            <li>
              <button
                type="button"
                onClick={() => {
                  onPick('other', query.trim());
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full rounded-field px-2 py-2 text-start text-sm font-bold text-cta hover:bg-cta-soft"
              >
                «{query.trim()}» را به‌عنوان برند دلخواه ثبت کن
              </button>
            </li>
          )}
          {query.trim() && options.length > 0 && (
            <li className="border-t border-line pt-1">
              <button
                type="button"
                onClick={() => {
                  onPick('other', query.trim());
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full rounded-field px-2 py-2 text-start text-xs font-bold text-cta hover:bg-cta-soft"
              >
                «{query.trim()}» در فهرست نیست — به‌عنوان برند دلخواه ثبت کن
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** Model combobox: suggestions from the picked brand, free text always allowed. */
function ModelPicker({
  suggestions,
  value,
  onChange,
}: {
  suggestions: readonly string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const q = value.trim().toLowerCase();
  const options = q
    ? suggestions.filter((model) => model.toLowerCase().includes(q))
    : suggestions.slice(0, 40);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <input
        id="model"
        role="combobox"
        aria-expanded={open}
        aria-controls="model-options"
        autoComplete="off"
        className="field"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        placeholder="مثلاً Land Cruiser VXR"
      />
      {open && options.length > 0 && (
        <ul
          id="model-options"
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-field border border-line bg-card p-1 shadow-xl"
        >
          {options.map((model) => (
            <li key={model}>
              <button
                type="button"
                onClick={() => {
                  onChange(model);
                  setOpen(false);
                }}
                className="w-full rounded-field px-2 py-1.5 text-start text-sm font-semibold text-muted transition hover:bg-cta-soft hover:text-ink"
              >
                <bdi>{model}</bdi>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ListingForm() {
  const rate = useAedRate();
  const perAed = rate?.aedToIrr ?? DEFAULT_AED_TO_IRR;

  // The category is asked first; parts carry their own payload.
  const [mode, setMode] = useState<ListingMode>('vehicle');
  const [category, setCategory] = useState<VehicleCategory>('car');
  const [partDraft, setPartDraft] = useState<PartDraft>(INITIAL_PART_DRAFT);
  const [draft, setDraft] = useState<Draft>(INITIAL_DRAFT);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Toman is what Kish buyers negotiate in; AED entry is a convenience that
  // still submits IRR (the one stored currency).
  const [unit, setUnit] = useState<PriceUnit>('toman');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);

  /* Option lists for the custom dropdowns — one shape for every field so all
     of them look and behave like the brand/model comboboxes. */
  const yearOptions: SelectOption[] = useMemo(
    () =>
      VEHICLE_YEARS.map((year) => ({
        value: String(year),
        label: toPersianDigits(year),
        hint: `${toPersianDigits(gregorianToJalaliYear(year))} شمسی`,
      })),
    [],
  );
  const gearboxOptions: SelectOption[] = useMemo(
    () => gearboxTypes.map((g) => ({ value: g, label: GEARBOX_LABELS[g] })),
    [],
  );
  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
    [],
  );
  const colorOptions: SelectOption[] = useMemo(
    () => colorSlugs.map((c) => ({ value: c, label: COLOR_LABELS[c] })),
    [],
  );
  const conditionOptions: SelectOption[] = conditions.map((c) => ({
    value: c,
    label: c === 'new' ? 'نو' : 'کارکرده',
  }));
  const bikeTypeOptions: SelectOption[] = BIKE_TYPES.map((type) => ({
    value: type.key,
    label: type.label,
  }));
  const heavyTypeOptions: SelectOption[] = HEAVY_TYPES.map((type) => ({
    value: type.key,
    label: type.label,
  }));
  const partCategoryOptions: SelectOption[] = partCategories.map((partCategory) => ({
    value: partCategory,
    label: PART_CATEGORY_LABELS[partCategory],
  }));
  const partOriginOptions: SelectOption[] = partOrigins.map((origin) => ({
    value: origin,
    label: PART_ORIGIN_LABELS[origin],
  }));
  const partConditionOptions: SelectOption[] = partConditions.map((condition) => ({
    value: condition,
    label: PART_CONDITION_LABELS[condition],
  }));
  const cityOptions: SelectOption[] = selectableCities().map((c) => ({
    value: c.slug,
    label: c.label,
  }));

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

  const setPart = <K extends keyof PartDraft>(key: K, value: PartDraft[K]) =>
    setPartDraft((d) => ({ ...d, [key]: value }));

  const brands = useMemo(() => brandsForCategory(category), [category]);
  const activeBrand = brands.find((b) => b.slug === draft.brand) ?? null;
  const plateStatementText = draft.plateType
    ? plateStatement(draft.plateType as PlateType)
    : null;

  /** Switching the category resets the marque to that category's first brand. */
  function switchCategory(next: VehicleCategory): void {
    setCategory(next);
    const first = brandsForCategory(next)[0];
    setDraft((d) => ({
      ...d,
      brand: first?.slug ?? 'other',
      customBrand: '',
      model: '',
      bikeType: next === 'motorcycle' ? d.bikeType : '',
      heavyType: next === 'heavy' ? d.heavyType : '',
      engineCc: next === 'motorcycle' ? d.engineCc : '',
      workingHours: next === 'heavy' ? d.workingHours : '',
    }));
    setFieldErrors({});
    setFormError(null);
  }

  function switchMode(next: ListingMode): void {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
  }

  /** Whatever the seller typed, converted to the IRR the schema stores. */
  function priceIRR(): number {
    const n = parseIntLoose(draft.priceIRR);
    if (!Number.isFinite(n) || n < 0) return Number.NaN;
    return unit === 'toman' ? tomanToIRR(n) : aedToIRR(n, perAed);
  }

  /** «۵۴ میلیارد و ۴۰۰ میلیون تومان · ≈ ۱٬۲۵۰٬۰۰۰ درهم» under the price field. */
  const priceWords = (() => {
    const irr = priceIRR();
    if (!Number.isFinite(irr) || irr <= 0) return null;
    const toman = irrToToman(irr);
    const words = tomanInWords(toman);
    const aed = formatAmountLatin(irrToAED(irr, perAed));
    return { toman, words, line: `${words} · ≈ ${aed} درهم` };
  })();

  /** Switch unit and restate the typed number in the new unit. */
  function switchUnit(next: PriceUnit): void {
    if (next === unit) return;
    const n = parseIntLoose(draft.priceIRR);
    if (Number.isFinite(n)) {
      const irr = unit === 'toman' ? tomanToIRR(n) : aedToIRR(n, perAed);
      set(
        'priceIRR',
        groupTypedAmount(String(next === 'toman' ? irrToToman(irr) : irrToAED(irr, perAed))),
      );
    }
    setUnit(next);
  }

  function photoPayload(): ListingPublish['photos'] {
    return photos.map((p, i) => ({
      // Durable path from POST /api/photos; the guard below blocks submission
      // while any photo is still uploading (empty path fails schema min length).
      path: p.path ?? '',
      mime: 'image/webp' as const,
      bytes: p.bytes,
      width: p.width,
      height: p.height,
      position: i,
    }));
  }

  function buildPayload(): unknown {
    if (mode === 'part') {
      return {
        kind: 'part',
        category: partDraft.category,
        title: partDraft.title.trim(),
        partNumber: partDraft.partNumber.trim() || null,
        compatibility: partDraft.compatibility.trim() || null,
        origin: partDraft.origin,
        condition: partDraft.condition,
        warranty: partDraft.warranty.trim() || null,
        priceIRR: Math.round(priceIRR()),
        city: draft.city,
        description: draft.description.trim(),
        photos: photoPayload(),
        showroomId: null,
        allowPhoneReveal: draft.allowPhoneReveal,
        hideAed: draft.hideAed,
      };
    }

    // A marque nobody preset: the free-typed name becomes «سایر» plus the
    // model line, so the card, the search and the filters all still work.
    const customBrand = draft.customBrand.trim();
    const model = draft.model.trim();
    // Electric scooters are rated in watts and may leave the volume empty; a
    // blank numeric field becomes null instead of NaN.
    const engineCc = parseIntLoose(draft.engineCc);
    const workingHours = parseIntLoose(draft.workingHours);
    return {
      kind: 'vehicle',
      category,
      engineCc: category === 'motorcycle' && Number.isFinite(engineCc) ? engineCc : null,
      bikeType: category === 'motorcycle' ? (draft.bikeType || null) : null,
      heavyType: category === 'heavy' ? (draft.heavyType || null) : null,
      workingHours: category === 'heavy' && Number.isFinite(workingHours) ? workingHours : null,
      vehicle: {
        brand: (customBrand ? 'other' : draft.brand) as VehicleInput['brand'],
        model: customBrand ? `${customBrand} ${model}`.trim() : model,
        trim: draft.trim.trim() || null,
        // Gregorian model year, stored as the one integer the cards read back.
        year: parseIntLoose(draft.year),
        mileageKm: parseIntLoose(draft.mileageKm),
        gearbox: draft.gearbox as VehicleInput['gearbox'],
        fuel: draft.fuel as VehicleInput['fuel'],
        color: draft.color as VehicleInput['color'],
        condition: draft.condition as VehicleInput['condition'],
        plateType: draft.plateType as PlateType,
        vin: draft.vin.trim() ? draft.vin.trim().toUpperCase() : null,
      },
      priceIRR: Math.round(priceIRR()),
      city: draft.city,
      description: draft.description.trim(),
      photos: photoPayload(),
      showroomId: null,
      allowPhoneReveal: draft.allowPhoneReveal,
      hideAed: draft.hideAed,
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
    // Red borders are applied by the Field wrapper; bring the first one into
    // view so a long form never leaves an off-screen error behind.
    if (Object.keys(errs).length > 0) {
      window.setTimeout(() => {
        document
          .querySelector('.field-invalid')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting || photosBusy) return;
    setFormError(null);
    setFieldErrors({});

    if (photos.some((p) => !p.path)) {
      setFormError('عکس‌ها هنوز بارگذاری نشده‌اند؛ چند لحظه صبر کنید و دوباره تلاش کنید.');
      return;
    }

    const payload = buildPayload();
    const parsed =
      mode === 'part'
        ? partListingPublishSchema.safeParse(payload)
        : listingPublishSchema.safeParse(payload);
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
      if (res.status === 401) {
        window.location.href = '/login?next=/new';
        return;
      }
      setFormError(body?.error ?? 'ارسال آگهی ناموفق بود؛ لطفاً دوباره تلاش کنید.');
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
    setPartDraft(INITIAL_PART_DRAFT);
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
        <p className="text-lg font-extrabold">آگهی شما منتشر شد</p>
        <p className="mt-1 text-sm text-muted">آگهی بلافاصله در فهرست نمایش داده می‌شود.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a href={`/listing/${successSlug}`} className="btn-cta text-sm">
            مشاهده آگهی
          </a>
          <a href="/profile/listings" className="btn-ghost text-sm">
            آگهی‌های من
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
        <h1 className="text-2xl font-extrabold">
          {mode === 'part'
            ? 'ثبت آگهی قطعه و لوازم جانبی'
            : `ثبت آگهی ${VEHICLE_CATEGORY_LABELS[category]}`}
        </h1>
        <p className="mt-1 text-sm text-muted">
          ابتدا دسته‌بندی را انتخاب کنید؛ فرم و فیلترها بر همان اساس تنظیم می‌شوند.
        </p>
      </div>

      {/* Step 1 — the category comes first. */}
      <StepCard step={1} title="دسته‌بندی آگهی">
        <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="دسته‌بندی آگهی">
          {CATEGORY_OPTIONS.map((option) => {
            const active = mode === 'vehicle' && category === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  switchMode('vehicle');
                  switchCategory(option.key);
                }}
                className={`rounded-field border p-3 text-start text-sm transition ${
                  active
                    ? 'border-cta bg-cta-soft font-extrabold text-ink'
                    : 'border-line bg-card text-muted hover:border-line-strong'
                }`}
              >
                <span className="block">{option.label}</span>
                <span className="mt-0.5 block text-[11px] font-bold text-faint">{option.hint}</span>
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={mode === 'part'}
            onClick={() => switchMode('part')}
            className={`rounded-field border p-3 text-start text-sm transition ${
              mode === 'part'
                ? 'border-cta bg-cta-soft font-extrabold text-ink'
                : 'border-line bg-card text-muted hover:border-line-strong'
            }`}
          >
            <span className="block">قطعه و لوازم جانبی</span>
            <span className="mt-0.5 block text-[11px] font-bold text-faint">
              قطعات یدکی، بدنه و لوازم
            </span>
          </button>
        </div>
      </StepCard>

      {formError && (
        <div
          className="rounded-field border-2 border-red-500 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300"
          role="alert"
        >
          {formError}
        </div>
      )}

      <StepCard step={2} title="مشخصات">
        {mode === 'vehicle' && (
          <>
            <Section title={SPEC_TITLE[category]}>
              <Field
                htmlFor="brand"
                label="برند"
                required
                hint="می‌توانید از فهرست پیشنهادی انتخاب کنید یا مدل/برند دیگری بنویسید."
                error={fieldErrors['vehicle.brand']}
              >
                <BrandPicker
                  category={category}
                  value={draft.brand}
                  custom={draft.customBrand}
                  onPick={(slug, custom) =>
                    setDraft((d) => ({ ...d, brand: slug, customBrand: custom, model: d.model }))
                  }
                />
              </Field>

              {draft.brand === 'other' && (
                <Field
                  htmlFor="customBrand"
                  label="نام برند دلخواه"
                  hint="نامی که در فهرست نبود را اینجا کامل بنویسید."
                >
                  <input
                    id="customBrand"
                    className="field"
                    value={draft.customBrand}
                    onChange={(e) => set('customBrand', e.target.value)}
                    placeholder="مثلاً بوگاتی"
                  />
                </Field>
              )}

              <Field
                htmlFor="model"
                label="مدل"
                required
                hint="می‌توانید از فهرست پیشنهادی انتخاب کنید یا مدل/برند دیگری بنویسید."
                error={fieldErrors['vehicle.model']}
              >
                <ModelPicker
                  suggestions={activeBrand?.models ?? []}
                  value={draft.model}
                  onChange={(next) => set('model', next)}
                />
              </Field>

              <Field htmlFor="trim" label="تیپ (اختیاری)" error={fieldErrors['vehicle.trim']}>
                <input
                  id="trim"
                  className="field"
                  value={draft.trim}
                  onChange={(e) => set('trim', e.target.value)}
                  placeholder="مثلاً VXR یا S 500"
                />
              </Field>

              <Field
                htmlFor="year"
                label="سال ساخت (میلادی)"
                required
                hint="سال میلادی خودرو را انتخاب کنید؛ معادل شمسی کنار هر گزینه نوشته شده است."
                error={fieldErrors['vehicle.year']}
              >
                <CustomSelect
                  id="year"
                  value={draft.year}
                  onChange={(next) => set('year', next)}
                  options={yearOptions}
                  placeholder="انتخاب سال…"
                  invalid={Boolean(fieldErrors['vehicle.year'])}
                />
              </Field>

              <Field
                htmlFor="mileageKm"
                label={category === 'heavy' ? 'کارکرد (کیلومتر)' : 'کارکرد (کیلومتر)'}
                required
                hint="عدد صحیح؛ صفر کیلومتر: ۰"
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

              {category === 'motorcycle' && (
                <>
                  {/* Electric scooters are rated in watts, not cc — the volume
                      field is only offered (and required) for petrol bikes. */}
                  <Field
                    htmlFor="engineCc"
                    label={
                      draft.fuel === 'electric'
                        ? 'توان موتور (وات) — اختیاری'
                        : 'حجم موتور (cc)'
                    }
                    required={draft.fuel !== 'electric'}
                    hint={
                      draft.fuel === 'electric'
                        ? 'مثلاً ۳۰۰۰ وات؛ برای موتورهای برقی خالی گذاشتن مجاز است.'
                        : 'مثلاً ۳۹۹ یا ۸۹۰'
                    }
                    error={fieldErrors.engineCc}
                  >
                    <input
                      id="engineCc"
                      inputMode="numeric"
                      className="field"
                      dir="ltr"
                      value={draft.engineCc}
                      onChange={(e) => set('engineCc', e.target.value)}
                      placeholder={draft.fuel === 'electric' ? '3000' : '890'}
                    />
                  </Field>

                  <Field
                    htmlFor="bikeType"
                    label="نوع موتور"
                    required
                    error={fieldErrors.bikeType}
                  >
                    <CustomSelect
                      id="bikeType"
                      value={draft.bikeType}
                      onChange={(next) => set('bikeType', next)}
                      options={bikeTypeOptions}
                      placeholder="نوع موتور را انتخاب کنید…"
                      invalid={Boolean(fieldErrors.bikeType)}
                    />
                  </Field>
                </>
              )}

              {category === 'heavy' && (
                <>
                  <Field
                    htmlFor="heavyType"
                    label="نوع ماشین‌آلات"
                    required
                    error={fieldErrors.heavyType}
                  >
                    <CustomSelect
                      id="heavyType"
                      value={draft.heavyType}
                      onChange={(next) => set('heavyType', next)}
                      options={heavyTypeOptions}
                      placeholder="نوع ماشین‌آلات را انتخاب کنید…"
                      invalid={Boolean(fieldErrors.heavyType)}
                    />
                  </Field>

                  <Field
                    htmlFor="workingHours"
                    label="ساعت کارکرد"
                    required
                    hint="مثلاً ۹٬۸۰۰ ساعت"
                    error={fieldErrors.workingHours}
                  >
                    <input
                      id="workingHours"
                      inputMode="numeric"
                      className="field"
                      dir="ltr"
                      value={draft.workingHours}
                      onChange={(e) => set('workingHours', e.target.value)}
                      placeholder="9800"
                    />
                  </Field>
                </>
              )}

              <Field
                htmlFor="gearbox"
                label={category === 'motorcycle' ? 'گیربکس / انتقال قدرت' : 'گیربکس'}
                required
                error={fieldErrors['vehicle.gearbox']}
              >
                <CustomSelect
                  id="gearbox"
                  value={draft.gearbox}
                  onChange={(next) => set('gearbox', next)}
                  options={gearboxOptions}
                  invalid={Boolean(fieldErrors['vehicle.gearbox'])}
                />
              </Field>

              <Field
                htmlFor="fuel"
                label={category === 'motorcycle' ? 'نوع سوخت / محرکه' : 'سوخت'}
                required
                error={fieldErrors['vehicle.fuel']}
              >
                <CustomSelect
                  id="fuel"
                  value={draft.fuel}
                  onChange={(next) => set('fuel', next)}
                  options={fuelOptions}
                  invalid={Boolean(fieldErrors['vehicle.fuel'])}
                />
              </Field>

              <Field htmlFor="color" label="رنگ" required error={fieldErrors['vehicle.color']}>
                <CustomSelect
                  id="color"
                  value={draft.color}
                  onChange={(next) => set('color', next)}
                  options={colorOptions}
                  invalid={Boolean(fieldErrors['vehicle.color'])}
                />
              </Field>

              <Field
                htmlFor="condition"
                label={category === 'heavy' ? 'وضعیت' : 'وضعیت خودرو'}
                required
                error={fieldErrors['vehicle.condition']}
              >
                <CustomSelect
                  id="condition"
                  value={draft.condition}
                  onChange={(next) => set('condition', next)}
                  options={conditionOptions}
                  placeholder="انتخاب کنید…"
                  invalid={Boolean(fieldErrors['vehicle.condition'])}
                />
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

            {/* Dedicated seller-declared plate section — no forced police notice. */}
            <Section title="وضعیت پلاک *">
              <div className="col-span-full grid gap-2 sm:grid-cols-4">
                {plateTypes.map((pt) => (
                  <label
                    key={pt}
                    className={`flex cursor-pointer items-center gap-2 rounded-field border p-3 text-sm font-bold transition ${
                      draft.plateType === pt
                        ? 'border-cta bg-cta-soft text-ink'
                        : fieldErrors['vehicle.plateType']
                          ? 'border-2 border-red-500 bg-red-50/40 text-red-700 dark:bg-red-950/20'
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
          </>
        )}

        {mode === 'part' && (
          <Section title="مشخصات قطعه">
            <Field htmlFor="partCategory" label="دسته‌بندی" required error={fieldErrors.category}>
              <CustomSelect
                id="partCategory"
                value={partDraft.category}
                onChange={(next) => setPart('category', next)}
                options={partCategoryOptions}
                placeholder="دسته‌بندی قطعه…"
                invalid={Boolean(fieldErrors.category)}
              />
            </Field>

            <Field htmlFor="partTitle" label="عنوان" required error={fieldErrors.title}>
              <input
                id="partTitle"
                className="field"
                value={partDraft.title}
                onChange={(e) => setPart('title', e.target.value)}
                placeholder="مثلاً دیسک ترمز جلو لندکروزر"
              />
            </Field>

            <Field htmlFor="partNumber" label="شماره فنی (اختیاری)" error={fieldErrors.partNumber}>
              <input
                id="partNumber"
                className="field font-mono"
                dir="ltr"
                value={partDraft.partNumber}
                onChange={(e) => setPart('partNumber', e.target.value)}
                placeholder="AB-1234"
              />
            </Field>

            <Field
              htmlFor="partCompatibility"
              label="سازگاری با خودرو (اختیاری)"
              hint="اگر خالی بماند، «سازگاری عمومی» نمایش داده می‌شود."
              error={fieldErrors.compatibility}
            >
              <input
                id="partCompatibility"
                className="field"
                value={partDraft.compatibility}
                onChange={(e) => setPart('compatibility', e.target.value)}
                placeholder="لندکروزر و پاترول"
              />
            </Field>

            <Field htmlFor="partOrigin" label="منشأ" required error={fieldErrors.origin}>
              <CustomSelect
                id="partOrigin"
                value={partDraft.origin}
                onChange={(next) => setPart('origin', next)}
                options={partOriginOptions}
                placeholder="منشأ قطعه…"
                invalid={Boolean(fieldErrors.origin)}
              />
            </Field>

            <Field htmlFor="partCondition" label="وضعیت" required error={fieldErrors.condition}>
              <CustomSelect
                id="partCondition"
                value={partDraft.condition}
                onChange={(next) => setPart('condition', next)}
                options={partConditionOptions}
                placeholder="وضعیت قطعه…"
                invalid={Boolean(fieldErrors.condition)}
              />
            </Field>

            <Field htmlFor="partWarranty" label="گارانتی (اختیاری)" error={fieldErrors.warranty}>
              <input
                id="partWarranty"
                className="field"
                value={partDraft.warranty}
                onChange={(e) => setPart('warranty', e.target.value)}
                placeholder="مثلاً 6 ماه"
              />
            </Field>
          </Section>
        )}
      </StepCard>

      <StepCard step={3} title="قیمت، عکس و تماس">
        <Section title="قیمت، شهر و تماس">
          <div className="col-span-full flex flex-wrap items-center gap-2" role="group" aria-label="واحد قیمت">
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
          <div className="col-span-full rounded-field border border-line bg-page px-3 py-2">
            <p className="mb-0.5 text-[11px] font-bold text-faint">نرخ روز درهم</p>
            <RateLine />
          </div>

          <Field
            htmlFor="priceIRR"
            label={`قیمت (${unit === 'toman' ? 'تومان' : 'درهم'})`}
            required
            hint={`قیمت را به ${unit === 'toman' ? 'تومان' : 'درهم'} بنویسید؛ ارقام فارسی یا انگلیسی مجاز است و جداکننده هزار خودکار اضافه می‌شود.`}
            error={fieldErrors['priceIRR']}
          >
            <input
              id="priceIRR"
              inputMode="numeric"
              autoComplete="off"
              className="field"
              value={draft.priceIRR}
              onChange={(e) => set('priceIRR', groupTypedAmount(e.target.value))}
              placeholder={unit === 'toman' ? 'مثلاً 34,000,000,000' : 'مثلاً 125,000'}
              aria-describedby="priceIRR-words"
            />
            <p
              id="priceIRR-words"
              aria-live="polite"
              className="mt-1.5 min-h-4 text-[11px] font-bold leading-5 text-muted"
            >
              {priceWords
                ? priceWords.line
                : 'مبلغ را با ارقام وارد کنید تا به حروف و درهم همین‌جا نوشته شود.'}
            </p>
          </Field>

          {/* City is a disabled select with کیش as the only option. */}
          <Field
            htmlFor="city"
            label="شهر"
            hint="در این مرحله فقط کیش فعال است."
            error={fieldErrors['city']}
          >
            <CustomSelect
              id="city"
              value={draft.city}
              onChange={(next) => set('city', next)}
              options={cityOptions}
              disabled
              invalid={Boolean(fieldErrors['city'])}
            />
          </Field>

          <label className="col-span-full flex cursor-pointer items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.hideAed}
              onChange={(e) => set('hideAed', e.target.checked)}
              className="mt-1 accent-[var(--color-accent)]"
            />
            <span>
              عدم نمایش قیمت درهم در آگهی (فقط نمایش قیمت به تومان)
              <span className="hint mt-0 block">
                خط «≈ … AED» روی کارت، فهرست و صفحه‌ی آگهی نمایش داده نمی‌شود.
              </span>
            </span>
          </label>

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
            label="توضیحات آگهی (اختیاری)"
            hint={`اختیاری است و حداقل نویسه ندارد — اکنون ${toPersianDigits(draft.description.trim().length)} نویسه`}
            error={fieldErrors['description']}
          >
            <textarea
              id="description"
              rows={5}
              className="field resize-y"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="وضعیت فنی، دلیل فروش، لوازم همراه…"
            />
          </Field>
        </Section>

        <Section title="عکس‌های آگهی">
          <div className="col-span-full">
            <p className="mb-2 text-xs font-bold text-muted">
              عکس اختیاری است؛ اگر عکسی انتخاب نکنید یک تصویر پیش‌فرض برای آگهی استفاده می‌شود.
            </p>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              onBusyChange={setPhotosBusy}
              error={fieldErrors['photos']}
            />
          </div>
        </Section>
      </StepCard>

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
