'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  BIKE_TYPES,
  CITY_LABELS,
  MAX_PHOTOS,
  DEFAULT_AED_TO_IRR,
  HEAVY_TYPES,
  brandsForCategory,
  BODY_TYPE_LABELS,
  CHASSIS_CONDITION_LABELS,
  PAINT_CONDITION_LABELS,
  FUEL_LABELS,
  LISTING_FIELD_LABELS,
  PART_CATEGORY_LABELS,
  PART_CONDITION_LABELS,
  PART_FIELD_LABELS,
  PART_ORIGIN_LABELS,
  PLATE_DECLARATION_FOOTER,
  PLATE_TYPE_LABELS,
  aedToIRR,
  aedToToman,
  bodyTypes,
  chassisConditions,
  conditions,
  fuelTypes,
  paintConditions,
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
  tomanInWords,
  tomanToIRR,
  type ListingPublish,
  type PlateType,
  type VehicleCategory,
  type VehicleInput,
} from '@alisales/schemas';
import { MENU_CATEGORY } from '@/lib/categories';
import type { ListingCardData } from '@/lib/data/listings';
import { ListingCard } from './ListingCard';
import { DeleteListingButton } from './DeleteListingButton';
import { CustomSelect, type SelectOption } from './CustomSelect';
import { YearGridSelect } from './YearGridSelect';
import { Icon } from './Icon';
import { CategorySelector } from './listing-form/CategorySelector';
import { FormField } from './listing-form/FormField';
import { FormSection } from './listing-form/FormSection';
import { RadioCardGroup } from './listing-form/RadioCardGroup';
import { SegmentedControl } from './listing-form/SegmentedControl';
import { StickyPublishBar } from './listing-form/StickyPublishBar';
import { ToggleRow } from './listing-form/ToggleRow';
import { PhotoUploader } from './PhotoUploader';
import { PriceEstimateHelper } from './PriceEstimateHelper';
import { PriceText } from './PriceText';
import { useAedRate } from './RateProvider';
import { useI18n } from '@/lib/i18n';
import {
  processListingMedia,
  uploadProcessedPhoto,
  type ProcessedPhoto,
} from '@/lib/photos';

/** Human labels for schema paths — shared with the mobile form. */
const FIELD_LABELS: Record<string, string> = { ...LISTING_FIELD_LABELS, ...PART_FIELD_LABELS };

const INITIAL_DRAFT = {
  brand: 'toyota',
  /** Free-typed brand when no catalogue marque matches. */
  customBrand: '',
  model: '',
  /** Standard body class (سدان / شاسی‌بلند / …). */
  bodyType: '',
  year: '',
  mileageKm: '',
  fuel: 'petrol',
  /** Free-text colour typed by the seller. */
  color: '',
  condition: '',
  plateType: '',
  vin: '',
  priceIRR: '',
  city: 'kish',
  description: '',
  allowPhoneReveal: true,
  /** «عدم نمایش قیمت درهم در آگهی» — Toman-only price. */
  hideAed: false,
  /** Motorcycle / heavy only. */
  engineCc: '',
  bikeType: '',
  heavyType: '',
  workingHours: '',
  /** Insurance / paint / chassis / inspection declarations (details only). */
  thirdPartyInsurance: '',
  thirdPartyMonths: '',
  bodyInsurance: '',
  bodyMonths: '',
  paintCondition: '',
  chassisCondition: '',
  technicalInspection: '',
  inspectionSheetUrl: '',
  /** Cover is a catalogue/internet photo, not the actual car. */
  isJournalPhoto: false,
};

type PriceUnit = 'toman' | 'aed';

type Draft = typeof INITIAL_DRAFT;

const INITIAL_PART_DRAFT = {
  category: '',
  title: '',
  partNumber: '',
  compatibility: '',
  /** Country of manufacture (کشور سازنده). */
  originCountry: '',
  /** Authenticity: اورجینال / استوک / تجاری / نامشخص. */
  origin: 'unknown',
  condition: '',
  warranty: '',
};

type PartDraft = typeof INITIAL_PART_DRAFT;
type ListingMode = 'vehicle' | 'part';

/**
 * The four listing types, each carrying the exact artwork the hamburger menu
 * uses for that category (`/icons/menu/*.svg`) — one icon language on the site.
 */
const CATEGORY_OPTIONS: ReadonlyArray<{
  key: VehicleCategory;
  label: string;
  en: string;
  iconSrc: string;
}> = [
  {
    key: 'car',
    label: MENU_CATEGORY.car.label,
    en: MENU_CATEGORY.car.en,
    iconSrc: MENU_CATEGORY.car.iconSrc,
  },
  {
    key: 'motorcycle',
    label: MENU_CATEGORY.motorcycle.label,
    en: MENU_CATEGORY.motorcycle.en,
    iconSrc: MENU_CATEGORY.motorcycle.iconSrc,
  },
  {
    key: 'heavy',
    label: MENU_CATEGORY.heavy.label,
    en: MENU_CATEGORY.heavy.en,
    iconSrc: MENU_CATEGORY.heavy.iconSrc,
  },
];

const PART_CATEGORY_CHOICE = {
  key: 'part',
  label: MENU_CATEGORY.parts.label,
  en: MENU_CATEGORY.parts.en,
  iconSrc: MENU_CATEGORY.parts.iconSrc,
} as const;

const BODY_EN: Record<string, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  coupe: 'Coupé',
  convertible: 'Convertible',
  hatchback: 'Hatchback',
  crossover: 'Crossover',
  pickup: 'Pickup',
  van: 'Van',
};

const FUEL_EN: Record<string, string> = {
  petrol: 'Petrol',
  diesel: 'Diesel',
  cng: 'Dual fuel (CNG)',
  hybrid: 'Hybrid',
  electric: 'Electric',
};

const BIKE_TYPE_EN: Record<string, string> = {
  scooter: 'Electric scooter',
  electric: 'Electric motorcycle',
  petrol_scooter: 'Petrol scooter',
  sport: 'Sport bike',
  cross: 'Cross / off-road',
  classic: 'Classic bike',
  touring: 'Touring bike',
};

const HEAVY_TYPE_EN: Record<string, string> = {
  truck: 'Truck',
  tractor: 'Tractor unit',
  trailer: 'Trailer',
  excavator: 'Excavator',
  loader: 'Loader',
  crane: 'Crane',
  dozer: 'Bulldozer',
  mixer: 'Concrete mixer',
  other: 'Other',
};

const PLATE_STATEMENT_EN: Record<string, string> = {
  kish: 'The seller has declared this vehicle as having a Kish Island plate.',
  temporary_transit: 'The seller has declared this vehicle as having a temporary transit plate.',
  unplated: 'The seller has declared this vehicle as unplated.',
};

/** The step-2 spec card is named after the category actually being filled. */
const SPEC_TITLE: Record<VehicleCategory, string> = {
  car: 'مشخصات خودرو',
  motorcycle: 'مشخصات موتور و اسکوتر',
  heavy: 'مشخصات ماشین‌آلات سنگین',
};


/**
 * «اعتبار باقی‌مانده» tray, revealed inline when an insurance toggle is on.
 *
 * An elevated white card with a live value pill and two rows of six month
 * buttons, so the remaining months are a deliberate choice instead of loose
 * numbers on the cream page.
 */
function MonthChips({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      role="group"
      aria-label={label}
      className="rounded-2xl border border-[#111144]/10 border-r-[3px] border-r-[#111144] bg-white p-3.5 shadow-sm dark:border-white/10 dark:border-r-[#F98513] dark:bg-white/[0.05]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-muted">
          {t('اعتبار باقی‌مانده', 'Remaining validity')}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tabular-nums ${
            value
              ? 'bg-[#111144] text-white dark:bg-[#F98513] dark:text-[#111144]'
              : 'bg-[#111144]/[0.07] text-[#111144]/70 dark:bg-white/10 dark:text-white/70'
          }`}
        >
          {value ? t(`${value} ماه`, `${value} months`) : t('انتخاب کنید', 'Choose')}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-6 gap-2">
        {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((month) => (
          <button
            key={month}
            type="button"
            aria-pressed={value === month}
            onClick={() => onChange(month)}
            className={`h-10 rounded-xl text-sm font-semibold transition-all ${
              value === month
                ? 'bg-[#111144] text-white shadow-sm ring-2 ring-[#111144]/20 dark:bg-[#F98513] dark:text-[#111144]'
                : 'border border-[#111144]/10 bg-[#F4F1EC] text-[#111144]/80 hover:border-[#111144]/30 dark:border-white/10 dark:bg-white/10 dark:text-white/80'
            }`}
          >
            {month}
          </button>
        ))}
      </div>
    </div>
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
  const { t } = useI18n();
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
        value={
          open
            ? query
            : (selected
                ? t(selected.label, selected.latin)
                : custom
                  ? `${custom} ${t('(دلخواه)', '(custom)')}`
                  : '')
        }
        onFocus={() => {
          setOpen(true);
          setQuery('');
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={t('جستجوی برند…', 'Search brands…')}
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
                {/* Persian on the RTL start (right), Latin on the LTR end. */}
                <span className="truncate font-extrabold">{brand.label}</span>
                <bdi dir="ltr" className="shrink-0 text-[11px] font-bold text-faint">
                  {brand.latin}
                </bdi>
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
                {t(
                  `«${query.trim()}» را به‌عنوان برند دلخواه ثبت کن`,
                  `Add “${query.trim()}” as a custom brand`,
                )}
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
                {t(
                  `«${query.trim()}» در فهرست نیست — به‌عنوان برند دلخواه ثبت کن`,
                  `“${query.trim()}” is not listed — add it as a custom brand`,
                )}
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
  const { t } = useI18n();
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
        placeholder={t('مثلاً Land Cruiser VXR', 'e.g. Land Cruiser VXR')}
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

/** Optional upload of an existing inspection sheet (image) + summary. */
function InspectionSheetField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div className="col-span-full">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[#111144]/20 bg-white/70 px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#111144]/[0.06] text-[#111144] dark:bg-white/10 dark:text-[#F4F1EC]">
            <Icon name="cameraPlus" size={17} />
          </span>
          <span className="min-w-0 text-xs font-semibold leading-5 text-ink">
            {t('برگه کارشناسی سلامت خودرو (اختیاری)', 'Vehicle inspection sheet (optional)')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#111144]/15 bg-white px-3 text-xs font-bold text-[#111144] shadow-sm transition hover:border-[#111144]/30 disabled:opacity-60 dark:border-white/15 dark:bg-white/10 dark:text-white"
        >
          {busy
            ? t('در حال بارگذاری…', 'Uploading…')
            : value
              ? t('تغییر تصویر', 'Change image')
              : t('انتخاب تصویر', 'Choose image')}
        </button>
      </div>
      {value && (
        <div className="mt-2 flex items-center justify-end gap-3 text-xs">
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-cta hover:underline"
          >
            {t('مشاهده برگه', 'View sheet')}
          </a>
          <button
            type="button"
            onClick={() => onChange('')}
            className="font-bold text-muted transition hover:text-ink"
          >
            {t('حذف', 'Remove')}
          </button>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setLocalError(null);
          try {
            const processed = await processListingMedia(file);
            const uploaded = await uploadProcessedPhoto(processed);
            onChange(uploaded.url ?? '');
          } catch {
            setLocalError(
              t('بارگذاری برگه کارشناسی ناموفق بود.', 'Could not upload the inspection sheet.'),
            );
          } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
          }
        }}
      />
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

export function ListingForm() {
  const { t, lang } = useI18n();
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
  /** The just-published row, rendered as a real card on the success screen. */
  const [publishedCard, setPublishedCard] = useState<ListingCardData | null>(null);

  /* Option lists for the custom dropdowns — one shape for every field so all
     of them look and behave like the brand/model comboboxes. */
  const bodyTypeOptions: SelectOption[] = bodyTypes.map((body) => ({
    value: body,
    label: t(BODY_TYPE_LABELS[body], BODY_EN[body]),
  }));
  const fuelOptions: SelectOption[] = useMemo(
    () => fuelTypes.map((f) => ({ value: f, label: t(FUEL_LABELS[f], FUEL_EN[f]) })),
    [t],
  );
  const conditionOptions: SelectOption[] = conditions.map((c) => ({
    value: c,
    label: c === 'new' ? t('نو', 'Brand New') : t('کارکرده', 'Used'),
  }));
  const bikeTypeOptions: SelectOption[] = BIKE_TYPES.map((type) => ({
    value: type.key,
    label: t(type.label, BIKE_TYPE_EN[type.key]),
  }));
  const heavyTypeOptions: SelectOption[] = HEAVY_TYPES.map((type) => ({
    value: type.key,
    label: t(type.label, HEAVY_TYPE_EN[type.key]),
  }));
  const partCategoryOptions: SelectOption[] = partCategories.map((partCategory) => ({
    value: partCategory,
    label: t(PART_CATEGORY_LABELS[partCategory]),
  }));
  const partAuthenticityOptions: SelectOption[] = partOrigins.map((origin) => ({
    value: origin,
    label: t(PART_ORIGIN_LABELS[origin]),
  }));
  const partConditionOptions: SelectOption[] = partConditions.map((condition) => ({
    value: condition,
    label: t(PART_CONDITION_LABELS[condition]),
  }));
  const cityOptions: SelectOption[] = selectableCities().map((c) => ({
    value: c.slug,
    label: t(c.label),
  }));
  const paintOptions: SelectOption[] = paintConditions.map((paint) => ({
    value: paint,
    label: t(PAINT_CONDITION_LABELS[paint]),
  }));
  const chassisOptions: SelectOption[] = chassisConditions.map((chassis) => ({
    value: chassis,
    label: t(CHASSIS_CONDITION_LABELS[chassis]),
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
    ? lang === 'en'
      ? (PLATE_STATEMENT_EN[draft.plateType] ?? null)
      : plateStatement(draft.plateType as PlateType)
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
    return {
      toman,
      words,
      line:
        lang === 'en'
          ? `${formatAmountLatin(toman)} Toman · ≈ ${aed} AED`
          : // The words formatter emits Persian digits; this page reads Latin only.
            `${toAsciiDigits(words)} · ≈ ${aed} درهم`,
    };
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
      mime: p.mime,
      bytes: p.bytes,
      width: p.width,
      height: p.height,
      position: i,
    }));
  }

  /**
   * A card-shaped view of what was just published, built from the submitted
   * payload and the uploaded media so the success screen shows the real ad
   * (cover, badges, price, specs) instead of a bare confirmation box.
   */
  function previewCard(
    data: ListingPublish | import('@alisales/schemas').PartListingPublish,
    slug: string,
    id: string,
    isPart: boolean,
  ): ListingCardData {
    const urls = photos.map((p) => p.url).filter((url): url is string => Boolean(url));
    const base = {
      id,
      slug,
      sellerId: 'me',
      priceIRR: data.priceIRR,
      city: data.city,
      state: 'active' as const,
      featured: false,
      publishedAt: new Date().toISOString(),
      hasReport: false,
      coverUrl: urls[0] ?? null,
      photos: urls,
      showroomName: null,
      showroomVerified: false,
      allowPhoneReveal: data.allowPhoneReveal,
      hideAed: data.hideAed,
    };
    if (isPart) {
      const partData = data as import('@alisales/schemas').PartListingPublish;
      return {
        ...base,
        brand: 'other',
        model: partData.title,
        trim: null,
        year: new Date().getFullYear(),
        mileageKm: 0,
        gearbox: 'automatic',
        fuel: 'petrol',
        color: '',
        // Card condition stays the vehicle pair; the part's own three-state
        // «وضعیت قطعه» travels on `part.condition` and renders its own badge.
        condition: partData.condition === 'new' ? 'new' : 'used',
        plateType: 'standard',
        kind: 'part',
        part: {
          title: partData.title,
          category: partData.category,
          origin: partData.origin,
          originCountry: partData.originCountry,
          condition: partData.condition,
          partNumber: partData.partNumber,
          compatibility: partData.compatibility,
          warranty: partData.warranty,
        },
      };
    }
    const vehicle = (data as ListingPublish).vehicle;
    return {
      ...base,
      brand: vehicle.brand,
      model: vehicle.model,
      trim: vehicle.trim,
      year: vehicle.year,
      mileageKm: vehicle.mileageKm,
      gearbox: vehicle.gearbox,
      fuel: vehicle.fuel,
      color: vehicle.color,
      bodyType: vehicle.bodyType,
      condition: vehicle.condition,
      plateType: vehicle.plateType,
      kind: 'vehicle',
      category,
    };
  }

  function buildPayload(): unknown {
    if (mode === 'part') {
      return {
        kind: 'part',
        category: partDraft.category,
        title: partDraft.title.trim(),
        partNumber: partDraft.partNumber.trim() || null,
        compatibility: partDraft.compatibility.trim() || null,
        originCountry: partDraft.originCountry.trim() || null,
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
        trim: null,
        bodyType: (draft.bodyType || null) as VehicleInput['bodyType'],
        // Gregorian model year, stored as the one integer the cards read back.
        year: parseIntLoose(draft.year),
        mileageKm: parseIntLoose(draft.mileageKm),
        fuel: draft.fuel as VehicleInput['fuel'],
        color: draft.color.trim(),
        condition: draft.condition as VehicleInput['condition'],
        plateType: draft.plateType as PlateType,
        thirdPartyInsurance:
          draft.thirdPartyInsurance === '' ? null : draft.thirdPartyInsurance === 'yes',
        thirdPartyMonths:
          draft.thirdPartyInsurance === 'yes' && draft.thirdPartyMonths
            ? parseIntLoose(draft.thirdPartyMonths)
            : null,
        bodyInsurance:
          draft.bodyInsurance === '' ? null : draft.bodyInsurance === 'yes',
        bodyMonths:
          draft.bodyInsurance === 'yes' && draft.bodyMonths
            ? parseIntLoose(draft.bodyMonths)
            : null,
        paintCondition: draft.paintCondition || null,
        chassisCondition: draft.chassisCondition || null,
        technicalInspection:
          draft.technicalInspection === '' ? null : draft.technicalInspection === 'yes',
        isJournalPhoto: draft.isJournalPhoto,
        inspectionSheetUrl: draft.inspectionSheetUrl.trim() || null,
        // The old summary field is retired; sellers upload the sheet itself.
        inspectionNote: null,
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
      setFormError(
        t(
          'عکس‌ها هنوز بارگذاری نشده‌اند؛ چند لحظه صبر کنید و دوباره تلاش کنید.',
          'Photos are still uploading; wait a moment and try again.',
        ),
      );
      return;
    }

    // Every required pick is checked together so the seller sees ALL empty
    // boxes outlined in red at once, not one error at a time.
    const missing: Record<string, string> = {};
    if (photos.length === 0) {
      missing.photos = t(
        'عکس‌ها — حداقل یک عکس برای انتشار آگهی لازم است.',
        'Photos — at least one photo is required to publish.',
      );
    }
    if (mode === 'vehicle') {
      if (!draft.model.trim())
        missing['vehicle.model'] = t('مدل — مدل خودرو را بنویسید.', 'Model — enter the model.');
      if (!draft.bodyType)
        missing['vehicle.bodyType'] = t(
          'تیپ / کلاس بدنه — یک گزینه انتخاب کنید.',
          'Trim / body class — choose an option.',
        );
      if (!draft.year)
        missing['vehicle.year'] = t('سال ساخت — سال را انتخاب کنید.', 'Model year — choose a year.');
      if (!draft.mileageKm.trim())
        missing['vehicle.mileageKm'] = t(
          'کارکرد — کارکرد را بنویسید.',
          'Mileage — enter the mileage.',
        );
      if (!draft.condition)
        missing['vehicle.condition'] = t(
          'وضعیت خودرو — یک گزینه انتخاب کنید.',
          'Vehicle condition — choose an option.',
        );
      if (!draft.color.trim())
        missing['vehicle.color'] = t('رنگ — رنگ خودرو را بنویسید.', 'Colour — enter the colour.');
      if (!draft.plateType)
        missing['vehicle.plateType'] = t(
          'وضعیت پلاک — یک گزینه انتخاب کنید.',
          'Plate status — choose an option.',
        );
    } else {
      if (!partDraft.category)
        missing.category = t('دسته‌بندی — یک گزینه انتخاب کنید.', 'Category — choose an option.');
      if (!partDraft.title.trim())
        missing.title = t('عنوان — عنوان قطعه را بنویسید.', 'Title — enter the part title.');
      if (!partDraft.condition)
        missing.condition = t(
          'وضعیت قطعه — یک گزینه انتخاب کنید.',
          'Part condition — choose an option.',
        );
      if (!partDraft.origin)
        missing.origin = t(
          'اصالت قطعه — یک گزینه انتخاب کنید.',
          'Part authenticity — choose an option.',
        );
    }
    if (Object.keys(missing).length > 0) {
      applyIssues(
        Object.entries(missing).map(([path, message]) => ({ path, message })),
      );
      setFormError(
        t(
          'لطفاً همه‌ی فیلدهای الزامی مشخص‌شده را تکمیل کنید.',
          'Please complete all highlighted required fields.',
        ),
      );
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
      setFormError(
        t('لطفاً خطاهای مشخص‌شده را برطرف کنید.', 'Please fix the highlighted fields.'),
      );
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
        id?: string;
        error?: string;
        issues?: { path: string; message: string }[];
      } | null;

      if (res.status === 201 && body?.slug) {
        setSuccessSlug(body.slug);
        setPublishedCard(
          previewCard(parsed.data, body.slug, body.id ?? body.slug, mode === 'part'),
        );
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (res.status === 400 && body?.issues) {
        applyIssues(body.issues);
        setFormError(t('اطلاعات ارسالی معتبر نیست.', 'The submitted details are not valid.'));
        return;
      }
      if (res.status === 401) {
        window.location.href = '/login?next=/new';
        return;
      }
      setFormError(
        body?.error ??
          t(
            'ارسال آگهی ناموفق بود؛ لطفاً دوباره تلاش کنید.',
            'Could not publish the listing; please try again.',
          ),
      );
    } catch {
      setFormError(
        t(
          'ارتباط با سرور برقرار نشد؛ اتصال اینترنت خود را بررسی کنید.',
          'Could not reach the server; check your internet connection.',
        ),
      );
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
    setPublishedCard(null);
  }

  const submitLabel = submitting
    ? t('در حال ارسال…', 'Publishing…')
    : photosBusy
      ? t('در حال پردازش عکس‌ها…', 'Processing photos…')
      : t('انتشار آگهی', 'Publish listing');

  if (successSlug) {
    return (
      <div className="mx-auto max-w-4xl space-y-5" role="status">
        <div className="rounded-card border border-line bg-card px-5 py-6 text-center sm:px-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cta-soft text-cta">
            <Icon name="checkCircle" size={26} />
          </span>
          <p className="mt-3 text-lg font-extrabold">
            {t('آگهی شما منتشر شد', 'Your listing is live')}
          </p>
        </div>

        {publishedCard && (
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
            {/* Phone: details first, preview card under it. Desktop keeps the
                card on the start edge and the details beside it. */}
            <div className="order-2 [&>article]:h-full sm:order-1">
              <ListingCard listing={publishedCard} />
            </div>
            <div className="order-1 rounded-card border border-line bg-card p-4 sm:order-2 sm:p-5">
              <h2 className="text-sm font-extrabold text-ink">
                {t('جزئیات آگهی', 'Listing details')}
              </h2>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-field border border-line bg-page p-2.5">
                  <dt className="font-bold text-muted">{t('قیمت', 'Price')}</dt>
                  <dd className="mt-1 font-extrabold text-ink">
                    <PriceText irr={publishedCard.priceIRR} hideAed={publishedCard.hideAed} />
                  </dd>
                </div>
                <div className="rounded-field border border-line bg-page p-2.5">
                  <dt className="font-bold text-muted">{t('شهر', 'City')}</dt>
                  <dd className="mt-1 font-extrabold text-ink">
                    {CITY_LABELS[publishedCard.city] ?? publishedCard.city}
                  </dd>
                </div>
                <div className="rounded-field border border-line bg-page p-2.5">
                  <dt className="font-bold text-muted">{t('وضعیت', 'Condition')}</dt>
                  <dd className="mt-1 font-extrabold text-ink">
                    {publishedCard.condition === 'new'
                      ? t('نو', 'Brand New')
                      : t('کارکرده', 'Used')}
                  </dd>
                </div>
                <div className="rounded-field border border-line bg-page p-2.5">
                  <dt className="font-bold text-muted">
                    {t('ارتباط با فروشنده', 'Seller contact')}
                  </dt>
                  <dd className="mt-1 font-extrabold text-ink">
                    {publishedCard.allowPhoneReveal
                      ? t('شماره تماس نمایش داده می‌شود', 'Phone number shown')
                      : t('فقط چت داخلی', 'In-app chat only')}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <a
                  href={`/listing/${successSlug}`}
                  className="btn-cta flex items-center justify-center gap-1.5 text-sm"
                >
                  <Icon name="share" size={16} />
                  {t('مشاهده در سایت', 'View listing')}
                </a>
                <a
                  href={`/edit/${publishedCard.id}`}
                  className="btn-ghost flex items-center justify-center gap-1.5 text-sm"
                >
                  <Icon name="pencil" size={16} />
                  {t('ویرایش آگهی', 'Edit listing')}
                </a>
                <div className="flex [&>button]:w-full [&>button]:justify-center">
                  <DeleteListingButton
                    id={publishedCard.id}
                    redirectTo="/profile/listings"
                    compact
                  />
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-ghost flex items-center justify-center gap-1.5 text-sm"
                >
                  <Icon name="plus" size={16} />
                  {t('ثبت آگهی دیگر', 'Post another listing')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="listing-entry mx-auto w-full max-w-4xl pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      <header>
        <h1 className="text-2xl font-extrabold text-ink sm:text-[28px]">
          {t('ثبت آگهی', 'Post an ad')}
        </h1>
      </header>

      {/* One flat column split by hairlines — no nested cards. */}
      <div className="mt-8 space-y-8">

        <FormSection title={t('دسته‌بندی آگهی', 'Listing category')}>
          <CategorySelector
            ariaLabel={t('دسته‌بندی آگهی', 'Listing category')}
            value={mode === 'part' ? PART_CATEGORY_CHOICE.key : category}
            onChange={(next) => {
              if (next === PART_CATEGORY_CHOICE.key) {
                switchMode('part');
                return;
              }
              switchMode('vehicle');
              switchCategory(next as VehicleCategory);
            }}
            options={[
              ...CATEGORY_OPTIONS.map((option) => ({
                key: option.key,
                label: t(option.label, option.en),
                iconSrc: option.iconSrc,
              })),
              {
                key: PART_CATEGORY_CHOICE.key,
                label: t(PART_CATEGORY_CHOICE.label, PART_CATEGORY_CHOICE.en),
                iconSrc: PART_CATEGORY_CHOICE.iconSrc,
              },
            ]}
          />
        </FormSection>

        {mode === 'vehicle' && (
          <>
            <FormSection
              title={t(
                SPEC_TITLE[category],
                category === 'car'
                  ? 'Vehicle specifications'
                  : category === 'motorcycle'
                    ? 'Bike & scooter specifications'
                    : 'Heavy machinery specifications',
              )}
            >
              <FormField
                htmlFor="brand"
                label={t('برند', 'Brand')}
                required
                error={fieldErrors['vehicle.brand']}
              >
                <BrandPicker
                  category={category}
                  value={draft.brand}
                  custom={draft.customBrand}
                  onPick={(slug, custom) =>
                    // A new marque invalidates the previously picked model.
                    setDraft((d) => ({ ...d, brand: slug, customBrand: custom, model: '' }))
                  }
                />
              </FormField>

              {draft.brand === 'other' && (
                <FormField
                  htmlFor="customBrand"
                  label={t('نام برند دلخواه', 'Custom brand name')}
                  hint={t(
                    'نامی که در فهرست نبود را اینجا کامل بنویسید.',
                    'Type the full name if it was not in the list.',
                  )}
                >
                  <input
                    id="customBrand"
                    className="field"
                    value={draft.customBrand}
                    onChange={(e) => set('customBrand', e.target.value)}
                    placeholder={t('مثلاً بوگاتی', 'e.g. Bugatti')}
                  />
                </FormField>
              )}

              <FormField
                htmlFor="model"
                label={t('مدل', 'Model')}
                required
                error={fieldErrors['vehicle.model']}
              >
                <ModelPicker
                  suggestions={activeBrand?.models ?? []}
                  value={draft.model}
                  onChange={(next) => set('model', next)}
                />
              </FormField>

              <FormField
                htmlFor="year"
                label={t('سال ساخت (میلادی)', 'Model year')}
                required
                error={fieldErrors['vehicle.year']}
              >
                <YearGridSelect
                  id="year"
                  value={draft.year}
                  onChange={(next) => set('year', next)}
                  invalid={Boolean(fieldErrors['vehicle.year'])}
                />
              </FormField>

              <FormField
                htmlFor="mileageKm"
                label={t('کارکرد (کیلومتر)', 'Mileage (km)')}
                required
                error={fieldErrors['vehicle.mileageKm']}
              >
                <input
                  id="mileageKm"
                  inputMode="numeric"
                  className="field text-end"
                  value={draft.mileageKm}
                  onChange={(e) => set('mileageKm', groupTypedAmount(e.target.value))}
                  placeholder={t('مثلاً 58,000', 'e.g. 58,000')}
                  dir="ltr"
                />
              </FormField>

              <FormField
                htmlFor="bodyType"
                label={t('تیپ / کلاس بدنه', 'Trim / body class')}
                required
                error={fieldErrors['vehicle.bodyType']}
              >
                <CustomSelect
                  id="bodyType"
                  value={draft.bodyType}
                  onChange={(next) => set('bodyType', next)}
                  options={bodyTypeOptions}
                  placeholder={t('کلاس بدنه را انتخاب کنید…', 'Choose a body class…')}
                  invalid={Boolean(fieldErrors['vehicle.bodyType'])}
                />
              </FormField>

              <FormField
                htmlFor="fuel"
                label={
                  category === 'motorcycle'
                    ? t('نوع سوخت / محرکه', 'Fuel / drivetrain')
                    : t('سوخت', 'Fuel')
                }
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
              </FormField>

              {category === 'motorcycle' && (
                <>
                  {/* Electric scooters are rated in watts, not cc — the volume
                      field is only offered (and required) for petrol bikes. */}
                  <FormField
                    htmlFor="engineCc"
                    label={
                      draft.fuel === 'electric'
                        ? t('توان موتور (وات) — اختیاری', 'Motor power (W) — optional')
                        : t('حجم موتور (cc)', 'Engine size (cc)')
                    }
                    required={draft.fuel !== 'electric'}
                    hint={
                      draft.fuel === 'electric'
                        ? t(
                            'مثلاً 3000 وات؛ برای موتورهای برقی خالی گذاشتن مجاز است.',
                            'e.g. 3,000 W; it may be left blank for electric bikes.',
                          )
                        : t('مثلاً 399 یا 890', 'e.g. 399 or 890')
                    }
                    error={fieldErrors.engineCc}
                  >
                    <input
                      id="engineCc"
                      inputMode="numeric"
                      className="field text-end"
                      dir="ltr"
                      value={draft.engineCc}
                      onChange={(e) => set('engineCc', groupTypedAmount(e.target.value))}
                      placeholder={draft.fuel === 'electric' ? '3,000' : '890'}
                    />
                  </FormField>

                  <FormField
                    htmlFor="bikeType"
                    label={t('نوع موتور', 'Bike type')}
                    required
                    error={fieldErrors.bikeType}
                  >
                    <CustomSelect
                      id="bikeType"
                      value={draft.bikeType}
                      onChange={(next) => set('bikeType', next)}
                      options={bikeTypeOptions}
                      placeholder={t('نوع موتور را انتخاب کنید…', 'Choose a bike type…')}
                      invalid={Boolean(fieldErrors.bikeType)}
                    />
                  </FormField>
                </>
              )}

              {category === 'heavy' && (
                <>
                  <FormField
                    htmlFor="heavyType"
                    label={t('نوع ماشین‌آلات', 'Machinery type')}
                    required
                    error={fieldErrors.heavyType}
                  >
                    <CustomSelect
                      id="heavyType"
                      value={draft.heavyType}
                      onChange={(next) => set('heavyType', next)}
                      options={heavyTypeOptions}
                      placeholder={t(
                        'نوع ماشین‌آلات را انتخاب کنید…',
                        'Choose a machinery type…',
                      )}
                      invalid={Boolean(fieldErrors.heavyType)}
                    />
                  </FormField>

                  <FormField
                    htmlFor="workingHours"
                    label={t('ساعت کارکرد', 'Operating hours')}
                    required
                    hint={t('مثلاً 9,800 ساعت', 'e.g. 9,800 hours')}
                    error={fieldErrors.workingHours}
                  >
                    <input
                      id="workingHours"
                      inputMode="numeric"
                      className="field text-end"
                      dir="ltr"
                      value={draft.workingHours}
                      onChange={(e) => set('workingHours', groupTypedAmount(e.target.value))}
                      placeholder="9,800"
                    />
                  </FormField>
                </>
              )}

              <FormField
                htmlFor="color"
                label={t('رنگ', 'Colour')}
                required
                error={fieldErrors['vehicle.color']}
              >
                <input
                  id="color"
                  className="field"
                  value={draft.color}
                  onChange={(e) => set('color', e.target.value)}
                  placeholder={t('مثلاً سفید صدفی، مشکی متالیک...', 'e.g. pearl white, metallic black…')}
                />
              </FormField>

              <FormField
                htmlFor="condition"
                label={category === 'heavy' ? t('وضعیت', 'Condition') : t('وضعیت خودرو', 'Vehicle condition')}
                required
                error={fieldErrors['vehicle.condition']}
              >
                <SegmentedControl
                  options={conditionOptions}
                  value={draft.condition}
                  onChange={(next) => set('condition', next)}
                  invalid={Boolean(fieldErrors['vehicle.condition'])}
                  ariaLabel={t(
                    category === 'heavy' ? 'وضعیت' : 'وضعیت خودرو',
                    category === 'heavy' ? 'Condition' : 'Vehicle condition',
                  )}
                />
              </FormField>

              <FormField
                htmlFor="vin"
                label={t('شماره شاسی (VIN)', 'VIN')}
                error={fieldErrors['vehicle.vin']}
              >
                <input
                  id="vin"
                  className="field font-mono"
                  dir="ltr"
                  value={draft.vin}
                  onChange={(e) => set('vin', e.target.value)}
                  placeholder={t('اختیاری — 17 کاراکتر انگلیسی', 'Optional — 17 Latin characters')}
                />
              </FormField>
            </FormSection>

            {/* Dedicated seller-declared plate section — no forced police notice. */}
            <FormSection title={t('وضعیت پلاک', 'Plate status')} required>
              <div className="col-span-full">
                <RadioCardGroup
                  ariaLabel={t('وضعیت پلاک', 'Plate status')}
                  options={plateTypes.map((pt) => ({
                    value: pt,
                    label: t(PLATE_TYPE_LABELS[pt]),
                  }))}
                  value={draft.plateType}
                  onChange={(next) => set('plateType', next)}
                  invalid={Boolean(fieldErrors['vehicle.plateType'])}
                />
              </div>
              {fieldErrors['vehicle.plateType'] && (
                <p className="error-text col-span-full" role="alert">
                  {fieldErrors['vehicle.plateType']}
                </p>
              )}
              {plateStatementText && (
                <div className="col-span-full rounded-field border border-line bg-page p-3 text-sm">
                  <p className="font-bold">{plateStatementText}</p>
                  <p className="mt-1 text-xs text-muted">
                    {t(
                      PLATE_DECLARATION_FOOTER,
                      'Plate status is declared by the seller.',
                    )}
                  </p>
                </div>
              )}
            </FormSection>

            {/* Declared insurance / paint / chassis / inspection. These are
                detail-page facts only — the grid card stays uncluttered. */}
            <FormSection
              title={t(
                'بیمه، رنگ، شاسی و معاینه فنی',
                'Insurance, paint, chassis & inspection',
              )}
            >
              <div className="col-span-full grid gap-3 sm:grid-cols-2">
                <div>
                  <ToggleRow
                    label={t('بیمه شخص ثالث', 'Third-party insurance')}
                    checked={draft.thirdPartyInsurance === 'yes'}
                    onChange={(next) => set('thirdPartyInsurance', next ? 'yes' : 'no')}
                  />
                  <div
                    className={`grid transition-all duration-200 ${
                      draft.thirdPartyInsurance === 'yes'
                        ? 'mt-2 grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      {draft.thirdPartyInsurance === 'yes' && (
                        <MonthChips
                          label={t(
                            'باقی‌مانده بیمه شخص ثالث',
                            'Third-party insurance remaining',
                          )}
                          value={draft.thirdPartyMonths}
                          onChange={(next) => set('thirdPartyMonths', next)}
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <ToggleRow
                    label={t('بیمه بدنه', 'Body insurance')}
                    checked={draft.bodyInsurance === 'yes'}
                    onChange={(next) => set('bodyInsurance', next ? 'yes' : 'no')}
                  />
                  <div
                    className={`grid transition-all duration-200 ${
                      draft.bodyInsurance === 'yes'
                        ? 'mt-2 grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="overflow-hidden">
                      {draft.bodyInsurance === 'yes' && (
                        <MonthChips
                          label={t('باقی‌مانده بیمه بدنه', 'Body insurance remaining')}
                          value={draft.bodyMonths}
                          onChange={(next) => set('bodyMonths', next)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <FormField
                htmlFor="paintCondition"
                label={t('وضعیت رنگ و بدنه', 'Paint & body condition')}
              >
                <CustomSelect
                  id="paintCondition"
                  value={draft.paintCondition}
                  onChange={(next) => set('paintCondition', next)}
                  options={paintOptions}
                  placeholder={t('وضعیت رنگ…', 'Paint condition…')}
                />
              </FormField>

              <FormField
                htmlFor="chassisCondition"
                label={t('وضعیت شاسی', 'Chassis condition')}
              >
                <CustomSelect
                  id="chassisCondition"
                  value={draft.chassisCondition}
                  onChange={(next) => set('chassisCondition', next)}
                  options={chassisOptions}
                  placeholder={t('وضعیت شاسی…', 'Chassis condition…')}
                />
              </FormField>

              <div className="col-span-full">
                <ToggleRow
                  label={t('معاینه فنی', 'Technical inspection')}
                  checked={draft.technicalInspection === 'yes'}
                  onChange={(next) => set('technicalInspection', next ? 'yes' : 'no')}
                />
              </div>

              <InspectionSheetField
                value={draft.inspectionSheetUrl}
                onChange={(next) => set('inspectionSheetUrl', next)}
                error={fieldErrors.inspectionSheetUrl}
              />
            </FormSection>
          </>
        )}

        {mode === 'part' && (
          <FormSection title={t('مشخصات قطعه', 'Part specifications')}>
            <FormField
              htmlFor="partCategory"
              label={t('دسته‌بندی', 'Category')}
              required
              error={fieldErrors.category}
            >
              <CustomSelect
                id="partCategory"
                value={partDraft.category}
                onChange={(next) => setPart('category', next)}
                options={partCategoryOptions}
                placeholder={t('دسته‌بندی قطعه…', 'Part category…')}
                invalid={Boolean(fieldErrors.category)}
              />
            </FormField>

            <FormField
              htmlFor="partTitle"
              label={t('عنوان', 'Title')}
              required
              error={fieldErrors.title}
            >
              <input
                id="partTitle"
                className="field"
                value={partDraft.title}
                onChange={(e) => setPart('title', e.target.value)}
                placeholder={t(
                  'مثلاً دیسک ترمز جلو لندکروزر',
                  'e.g. front brake disc for Land Cruiser',
                )}
              />
            </FormField>

            <FormField
              htmlFor="partNumber"
              label={t('شماره فنی (اختیاری)', 'Part number (optional)')}
              error={fieldErrors.partNumber}
            >
              <input
                id="partNumber"
                className="field font-mono"
                dir="ltr"
                value={partDraft.partNumber}
                onChange={(e) => setPart('partNumber', e.target.value)}
                placeholder="AB-1234"
              />
            </FormField>

            <FormField
              htmlFor="partCompatibility"
              label={t('سازگاری با خودرو (اختیاری)', 'Vehicle compatibility (optional)')}
              hint={t(
                'اگر خالی بماند، «سازگاری عمومی» نمایش داده می‌شود.',
                'If left blank, it is shown as “universal compatibility”.',
              )}
              error={fieldErrors.compatibility}
            >
              <input
                id="partCompatibility"
                className="field"
                value={partDraft.compatibility}
                onChange={(e) => setPart('compatibility', e.target.value)}
                placeholder={t('لندکروزر و پاترول', 'Land Cruiser and Patrol')}
              />
            </FormField>

            <FormField
              htmlFor="partOriginCountry"
              label={t('کشور سازنده', 'Country of manufacture')}
              error={fieldErrors.originCountry}
            >
              <input
                id="partOriginCountry"
                className="field"
                value={partDraft.originCountry}
                onChange={(e) => setPart('originCountry', e.target.value)}
                placeholder={t('مثلاً ژاپن، آلمان، امارات...', 'e.g. Japan, Germany, UAE…')}
              />
            </FormField>

            <FormField
              htmlFor="partCondition"
              label={t('وضعیت قطعه', 'Part condition')}
              required
              error={fieldErrors.condition}
            >
              <CustomSelect
                id="partCondition"
                value={partDraft.condition}
                onChange={(next) => setPart('condition', next)}
                options={partConditionOptions}
                placeholder={t('وضعیت قطعه…', 'Part condition…')}
                invalid={Boolean(fieldErrors.condition)}
              />
            </FormField>

            <FormField
              htmlFor="partOrigin"
              label={t('اصالت قطعه', 'Part authenticity')}
              required
              error={fieldErrors.origin}
            >
              <CustomSelect
                id="partOrigin"
                value={partDraft.origin}
                onChange={(next) => setPart('origin', next)}
                options={partAuthenticityOptions}
                placeholder={t('اصالت قطعه…', 'Part authenticity…')}
                invalid={Boolean(fieldErrors.origin)}
              />
            </FormField>

            <FormField
              htmlFor="partWarranty"
              label={t('گارانتی (اختیاری)', 'Warranty (optional)')}
              error={fieldErrors.warranty}
            >
              <input
                id="partWarranty"
                className="field"
                value={partDraft.warranty}
                onChange={(e) => setPart('warranty', e.target.value)}
                placeholder={t('مثلاً 6 ماه', 'e.g. 6 months')}
              />
            </FormField>
          </FormSection>
        )}
        <FormSection title={t('قیمت و توضیحات', 'Price and description')}>
          <div className="col-span-full flex items-center justify-between gap-3 rounded-xl border border-[#111144]/10 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-[11px] font-bold text-faint">
              {t('نرخ روز درهم', 'Today’s AED rate')}
            </p>
            <p className="text-[11px] font-extrabold leading-5 text-ink tabular-nums">
              {lang === 'en'
                ? `1 AED ≈ ${formatAmountLatin(aedToToman(perAed))} Toman`
                : `1 درهم ≈ ${formatAmountLatin(aedToToman(perAed))} تومان`}
            </p>
          </div>

          <FormField
            htmlFor="priceIRR"
            label={t(
              `قیمت (${unit === 'toman' ? 'تومان' : 'درهم'})`,
              `Price (${unit === 'toman' ? 'Toman' : 'AED'})`,
            )}
            required
            error={fieldErrors['priceIRR']}
          >
            <div className="flex items-stretch gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="priceIRR"
                  inputMode="numeric"
                  autoComplete="off"
                  className="field pe-11 text-end"
                  value={draft.priceIRR}
                  onChange={(e) => set('priceIRR', groupTypedAmount(e.target.value))}
                  placeholder={
                    unit === 'toman'
                      ? t('مثلاً 34,000,000,000', 'e.g. 34,000,000,000')
                      : t('مثلاً 125,000', 'e.g. 125,000')
                  }
                  aria-describedby="priceIRR-words"
                />
                {draft.priceIRR && (
                  <button
                    type="button"
                    onClick={() => set('priceIRR', '')}
                    aria-label={t('پاک کردن قیمت', 'Clear price')}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted transition hover:bg-page hover:text-ink"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </div>
              {/* The currency is a control of its own, not a chip inside the field. */}
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
            {priceWords && (
              <p
                id="priceIRR-words"
                aria-live="polite"
                className="mt-1.5 text-[11px] font-bold leading-5 text-muted"
              >
                {priceWords.line}
              </p>
            )}
          </FormField>

          {/* City is a disabled select with کیش as the only option. */}
          <FormField
            htmlFor="city"
            label={t('شهر', 'City')}
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
          </FormField>

          {/* Vehicle comps only: a part has no brand/model/year of its own. */}
          {mode === 'vehicle' && (
            <div className="col-span-full">
              <PriceEstimateHelper
                brand={draft.brand}
                model={draft.model}
                year={draft.year}
                plateType={draft.plateType}
                category={category}
              />
            </div>
          )}

          <ToggleRow
            className="col-span-full"
            label={t(
              'عدم نمایش قیمت درهم در آگهی',
              'Hide the AED price on this listing',
            )}
            hint={t(
              'خط درهم روی کارت و صفحه آگهی نمایش داده نمی‌شود.',
              'The AED line is hidden on cards and the listing page.',
            )}
            checked={draft.hideAed}
            onChange={(next) => set('hideAed', next)}
          />

          {/* Phone visibility is ON by default; the switch is the opt-out. */}
          <ToggleRow
            className="col-span-full"
            label={t(
              'عدم نمایش شماره تماس در آگهی (فقط چت درون‌برنامه‌ای)',
              'Hide my phone number (in-app chat only)',
            )}
            hint={t(
              'شماره تماس مخفی می‌شود؛ خریدار فقط از طریق چت پیام می‌دهد.',
              'Your number stays hidden; buyers can only use in-app chat.',
            )}
            checked={!draft.allowPhoneReveal}
            onChange={(next) => set('allowPhoneReveal', !next)}
          />
        </FormSection>

        <FormSection title={t('توضیحات', 'Description')} columns="two">
          <FormField
            className="col-span-full"
            htmlFor="description"
            label={t('توضیحات آگهی (اختیاری)', 'Listing description (optional)')}
            error={fieldErrors['description']}
          >
            <textarea
              id="description"
              rows={5}
              className="field resize-y"
              value={draft.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder={t(
                'وضعیت فنی، دلیل فروش، لوازم همراه…',
                'Mechanical condition, reason for selling, included accessories…',
              )}
            />
          </FormField>
        </FormSection>

        <FormSection
          title={t('عکس‌های آگهی', 'Listing photos')}
          required
          meta={
            lang === 'en'
              ? `${photos.length} of ${MAX_PHOTOS}`
              : `${photos.length} از ${MAX_PHOTOS}`
          }
        >
          <div
            className={`col-span-full rounded-field ${
              fieldErrors['photos']
                ? 'border-2 border-red-500 bg-red-50/40 p-2 dark:bg-red-950/30'
                : ''
            }`}
          >
            <p className="mb-2 text-xs font-bold text-muted">
              {t(
                'بارگذاری حداقل یک عکس الزامی است؛ عکس اول کاور آگهی است و در اسلات‌های بعدی می‌توانید ویدیو هم اضافه کنید.',
                'At least one photo is required; the first is the cover and later slots can also hold video.',
              )}
            </p>
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              onBusyChange={setPhotosBusy}
              error={fieldErrors['photos']}
              showCounter={false}
            />
            <ToggleRow
              className="mt-3"
              label={t(
                'عکس ژورنال است (تصویر اینترنتی/کاتالوگ)',
                'This is a journal photo (catalogue/internet image)',
              )}
              hint={t(
                'با فعال بودن این گزینه، برچسب «عکس ژورنال» در مشخصات تکمیلی آگهی نمایش داده می‌شود تا خریدار بداند تصویر کاتالوگی است.',
                'When enabled, a “Journal photo” tag appears in the supplementary specs so buyers know it is a catalogue image.',
              )}
              checked={draft.isJournalPhoto}
              onChange={(next) => set('isJournalPhoto', next)}
            />
          </div>
        </FormSection>
      </div>

      {formError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-red-500/60 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          <Icon name="alertCircle" size={16} className="mt-0.5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* Desktop: one publish action at the end of the form. */}
      <div className="mt-8 hidden flex-col items-end gap-2 lg:flex">
        <button
          type="submit"
          disabled={submitting || photosBusy}
          className="btn-cta w-full max-w-[280px] text-sm disabled:opacity-60"
        >
          {submitLabel}
        </button>
        <p className="text-[11px] leading-5 text-faint">
          {t(
            'با ثبت آگهی، صحت اطلاعات و وضعیت پلاک را تأیید می‌کنید.',
            'By posting, you confirm the accuracy of the information and plate status.',
          )}
        </p>
      </div>

      {/* Phone: publish stays above the tab bar and never covers a field. */}
      <StickyPublishBar label={submitLabel} disabled={submitting || photosBusy} />
    </form>
  );
}
