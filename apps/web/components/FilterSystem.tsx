'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  BIKE_TYPES,
  CONDITION_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  HEAVY_TYPES,
  CHASSIS_CONDITION_LABELS,
  INSURANCE_KIND_LABELS,
  PAINT_CONDITION_LABELS,
  PLATE_TYPE_LABELS,
  LATEST_VEHICLE_YEAR,
  VEHICLE_YEARS,
  brandsForCategory,
  modelsForBrand,
  conditions,
  chassisConditions,
  fuelTypes,
  gearboxTypes,
  insuranceKinds,
  paintConditions,
  irrToToman,
  plateTypes,
  toAsciiDigits,
  tomanToIRR,
  pickYearRange,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { countMatches, type FilterableListing } from '@/lib/filter-match';
import { RateLine } from './RateLine';
import { FilterDrawerShell } from './FilterDrawerShell';
import { Icon } from './Icon';
import { CustomSelect } from './CustomSelect';
import { useI18n } from '@/lib/i18n';

/**
 * The filter system for the vehicle pages.
 *
 * Filters live in a right-hand drawer at every width (see FilterDrawerShell):
 * collapsible groups, each option carrying its live result count (computed with
 * the same predicate the server search uses, so a count can never disagree
 * with the grid), plus a sticky footer showing «نمایش N آگهی» and «پاک کردن
 * همه». On a wide screen the panel opens beside the grid instead of over it.
 *
 * Active filters are removable chips above the grid (see FilterChips).
 */

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function intOrUndefined(raw: string): number | undefined {
  const ascii = toAsciiDigits(raw).replace(/[^\d]/g, '');
  if (!ascii) return undefined;
  const n = Number.parseInt(ascii, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Live count for a candidate filter set. */
function countFor(pool: readonly FilterableListing[], next: SearchFilters): number {
  return countMatches(pool, next);
}

function Group({
  title,
  open = false,
  children,
}: {
  title: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group border-b border-line py-2 last:border-b-0">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 py-1 text-sm font-extrabold text-ink">
        {title}
        <Icon
          name="chevronDown"
          size={16}
          className="text-muted transition group-open:rotate-180"
        />
      </summary>
      <div className="pb-2 pt-1">{children}</div>
    </details>
  );
}

function PillOption({
  checked,
  label,
  count,
  onToggle,
}: {
  checked: boolean;
  label: string;
  count?: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition active:scale-[0.98] ${
        checked
          ? 'border-[#F98513] bg-[#F98513] font-bold text-[#111144] shadow-xs'
          : 'border-slate-200/80 bg-[#F4F1EC] font-medium text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] tabular-nums ${checked ? 'text-[#111144]/80' : 'text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function PillGroup({ children }: { children: ReactNode }) {
  return <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>;
}

const GRID_YEARS = VEHICLE_YEARS.filter((year) => year <= 2026 && year >= 1995);

/**
 * Year picker popover — a 4-column grid of model years instead of two typed
 * inputs. The first tap starts the range («از سال»), the second closes it
 * («تا سال»); tapping a year already inside the range clears it. Colours use
 * the theme tokens so it reads correctly in light and dark mode, and the
 * active cells take the brand orange (#F98513).
 */
function YearGrid({
  from,
  to,
  onChange,
}: {
  from: number | undefined;
  to: number | undefined;
  onChange: (next: { yearFrom?: number; yearTo?: number }) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeBound, setActiveBound] = useState<'from' | 'to'>('from');
  const closeTimer = useRef<number | null>(null);
  const active = from !== undefined || to !== undefined;

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );
  // «تا سال» defaults to the current latest model year. It is a display
  // default until the buyer actually picks a second year, so the URL is not
  // rewritten with a yearTo=2026 filter on every page load.
  const toDisplay = to ?? LATEST_VEHICLE_YEAR;
  const earliest = GRID_YEARS[GRID_YEARS.length - 1] ?? 1995;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (year: number) => {
    const next = pickYearRange(
      { yearFrom: from, yearTo: to },
      year,
      activeBound,
      { earliest, latest: LATEST_VEHICLE_YEAR },
    );
    onChange(next.range);
    setActiveBound(next.activeBound);
    // Two completed bounds are the end of this range: let the orange
    // confirmation land for a moment, then get out of the buyer's way.
    if (next.activeBound === 'from' && next.range.yearFrom !== undefined && next.range.yearTo !== undefined) {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(() => setOpen(false), 180);
    }
  };

  const reset = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    onChange({ yearFrom: undefined, yearTo: undefined });
    setActiveBound('from');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-field border px-3 py-2 text-xs font-bold transition ${
          active
            ? 'border-cta bg-cta-soft text-ink'
            : 'border-line bg-card text-muted hover:border-line-strong hover:text-ink'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Icon name="clock" size={14} />
          {from === undefined && to === undefined
            ? 'انتخاب سال ساخت'
            : from !== undefined
              ? `${from} تا ${toDisplay}`
              : `از 1995 تا ${toDisplay}`}
        </span>
        <Icon name="chevronDown" size={14} className={open ? 'rotate-180' : undefined} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('انتخاب سال ساخت', 'Choose model year')}
          className="absolute inset-x-0 top-full z-30 mt-2 rounded-card border border-line bg-card p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveBound('from')}
              aria-pressed={activeBound === 'from'}
              className={`min-h-10 min-w-0 flex-1 rounded-field border px-2 py-1.5 text-start transition ${
                activeBound === 'from'
                  ? 'border-[#F98513]/50 bg-[#F98513]/10 text-ink'
                  : 'border-line bg-page text-muted hover:border-line-strong'
              }`}
            >
              <span className="block text-[9px] font-bold text-muted">
                {t('از سال', 'From year')}
              </span>
              <b className="block text-xs font-extrabold text-ink">
                {from !== undefined ? from : t('انتخاب', 'Select')}
              </b>
            </button>
            <button
              type="button"
              onClick={() => setActiveBound('to')}
              aria-pressed={activeBound === 'to'}
              className={`min-h-10 min-w-0 flex-1 rounded-field border px-2 py-1.5 text-start transition ${
                activeBound === 'to'
                  ? 'border-[#F98513]/50 bg-[#F98513]/10 text-ink'
                  : 'border-line bg-page text-muted hover:border-line-strong'
              }`}
            >
              <span className="block text-[9px] font-bold text-muted">
                {t('تا سال', 'To year')}
              </span>
              <b className="block text-xs font-extrabold text-ink">{toDisplay}</b>
            </button>
            {active && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink"
              >
                {t('پاک کردن', 'Clear')}
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {GRID_YEARS.map((year) => {
              const isFrom = year === from;
              const isTo = year === to;
              const between =
                from !== undefined &&
                to !== undefined &&
                year > Math.min(from, to) &&
                year < Math.max(from, to);
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => pick(year)}
                  aria-pressed={isFrom || isTo}
                  className={`min-h-10 rounded-field border py-1.5 text-xs font-extrabold tabular-nums transition ${
                    isFrom || isTo
                      ? 'border-[#F98513] bg-[#F98513] text-[#111144]'
                      : between
                        ? 'border-[#F98513]/25 bg-[#F98513]/15 text-[#111144] hover:border-[#F98513]/50 dark:text-white'
                        : 'border-line bg-page text-muted hover:border-cta hover:text-ink'
                  }`}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RangePair({
  label,
  from,
  to,
  onFrom,
  onTo,
  placeholderFrom = 'از',
  placeholderTo = 'تا',
}: {
  label: string;
  from: number | undefined;
  to: number | undefined;
  onFrom: (value: number | undefined) => void;
  onTo: (value: number | undefined) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold text-faint">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="field text-xs"
          inputMode="numeric"
          value={from ?? ''}
          onChange={(e) => onFrom(intOrUndefined(e.target.value))}
          placeholder={placeholderFrom}
          aria-label={`${label} از`}
        />
        <input
          className="field text-xs"
          inputMode="numeric"
          value={to ?? ''}
          onChange={(e) => onTo(intOrUndefined(e.target.value))}
          placeholder={placeholderTo}
          aria-label={`${label} تا`}
        />
      </div>
    </div>
  );
}

/** Model selector filtered by the chosen brand, with a free-text fallback. */
function BrandModelPicker({
  brandSlug,
  value,
  onChange,
}: {
  brandSlug: string;
  value: string;
  onChange: (model: string) => void;
}) {
  const { t } = useI18n();
  const models = modelsForBrand(brandSlug);
  const known = models.includes(value);
  return (
    <div className="space-y-2">
      {models.length > 0 ? (
        <CustomSelect
          value={known ? value : ''}
          onChange={onChange}
          ariaLabel="مدل خودرو"
          placeholder={t('همه مدل‌ها')}
          options={[
            { value: '', label: 'همه مدل‌ها' },
            ...models.map((model) => ({ value: model, label: model })),
          ]}
        />
      ) : (
        <p className="text-[11px] font-bold text-faint">
          برای این برند مدل پیشنهادی نداریم؛ نام مدل را بنویسید.
        </p>
      )}
      <input
        className="field text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('یا نام مدل را بنویسید…', 'Or type the model name...')}
        aria-label={t('جستجوی مدل', 'Search model')}
      />
    </div>
  );
}

/** Every group of the filter set, shared by the drawer at every width. */
export function FilterGroups({
  category,
  filters,
  onChange,
  pool,
}: {
  category: VehicleCategory;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  pool: readonly FilterableListing[];
}) {
  const { t } = useI18n();
  const brands = brandsForCategory(category);
  const [brandQuery, setBrandQuery] = useState('');
  const [showAllBrands, setShowAllBrands] = useState(false);
  const q = brandQuery.trim().toLowerCase();
  const visibleBrands = (
    q
      ? brands.filter((b) => b.label.toLowerCase().includes(q) || b.latin.toLowerCase().includes(q))
      : brands
  ).slice(0, showAllBrands || q ? undefined : 8);

  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="space-y-0">
      <Group title={t('قیمت (تومان)', 'Price (Toman)')} open>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.priceFrom !== undefined ? irrToToman(filters.priceFrom) : ''}
            onChange={(e) => {
              const n = intOrUndefined(e.target.value);
              set({ priceFrom: n === undefined ? undefined : tomanToIRR(n) });
            }}
            placeholder={t('از', 'From')}
            aria-label={t('قیمت از', 'Price from')}
          />
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.priceTo !== undefined ? irrToToman(filters.priceTo) : ''}
            onChange={(e) => {
              const n = intOrUndefined(e.target.value);
              set({ priceTo: n === undefined ? undefined : tomanToIRR(n) });
            }}
            placeholder={t('تا', 'To')}
            aria-label={t('قیمت تا', 'Price to')}
          />
        </div>
        <div className="mt-1">
          <RateLine />
        </div>
      </Group>

      <Group title={t('سال ساخت (میلادی)', 'Model year (Gregorian)')} open>
        <YearGrid
          from={filters.yearFrom}
          to={filters.yearTo}
          onChange={(next) => set(next)}
        />
      </Group>

      <Group title={t('کارکرد (کیلومتر)', 'Mileage (km)')} open>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.mileageMin !== undefined ? filters.mileageMin.toLocaleString('en-US') : ''}
            onChange={(e) => set({ mileageMin: intOrUndefined(e.target.value) })}
            placeholder={t('از … کیلومتر', 'From … km')}
            aria-label={t('کارکرد از', 'Mileage from')}
          />
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.mileageMax !== undefined ? filters.mileageMax.toLocaleString('en-US') : ''}
            onChange={(e) => set({ mileageMax: intOrUndefined(e.target.value) })}
            placeholder={t('تا … کیلومتر', 'Up to … km')}
            aria-label={t('کارکرد تا', 'Mileage up to')}
          />
        </div>
        <p className="mt-1 text-[10px] font-bold text-faint">
          {t(
            'مثلاً از ۰ تا ۵۰۰,۰۰۰ کیلومتر؛ ارقام فارسی هم قبول است.',
            'For example 0 to 500,000 km; Persian digits are accepted too.',
          )}
        </p>
      </Group>

      {category === 'motorcycle' && (
        <Group title={t('حجم موتور (cc)', 'Engine size (cc)')} open>
          <RangePair
            label={t('بازه‌ی حجم', 'Displacement range')}
            from={filters.engineCcMin}
            to={filters.engineCcMax}
            onFrom={(v) => set({ engineCcMin: v })}
            onTo={(v) => set({ engineCcMax: v })}
          />
        </Group>
      )}

      {category === 'heavy' && (
        <Group title={t('ساعت کارکرد', 'Working hours')} open>
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.workingHoursMax ?? ''}
            onChange={(e) => set({ workingHoursMax: intOrUndefined(e.target.value) })}
            placeholder={t('حداکثر ساعت کارکرد', 'Maximum operating hours')}
            aria-label={t('حداکثر ساعت کارکرد', 'Maximum operating hours')}
          />
        </Group>
      )}

      <Group title={t('برند', 'Brand')} open>
        <input
          className="field text-xs"
          value={brandQuery}
          onChange={(e) => setBrandQuery(e.target.value)}
          placeholder={t('جستجوی برند…', 'Search brands...')}
          aria-label={t('جستجوی برند در فیلتر', 'Search brands in filters')}
        />
        <PillGroup>
          {visibleBrands.map((brand) => (
            <PillOption
              key={brand.slug}
              checked={filters.brand.includes(brand.slug as SearchFilters['brand'][number])}
              label={brand.latin}
              count={countFor(pool, {
                ...filters,
                brand: [brand.slug as SearchFilters['brand'][number]],
              })}
              onToggle={() =>
                set({
                  brand: toggle(filters.brand, brand.slug as SearchFilters['brand'][number]),
                })
              }
            />
          ))}
        </PillGroup>
        {!q && brands.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAllBrands((v) => !v)}
            className="mt-2 inline-flex min-h-9 items-center rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-ink transition hover:border-cta hover:text-cta"
          >
            {showAllBrands
              ? t('نمایش کمتر', 'Show less')
              : t(`نمایش همه‌ی ${brands.length} برند`, `Show all ${brands.length} brands`)}
          </button>
        )}
      </Group>

      {/* Dependent model group: it appears as soon as a brand is picked and is
          populated from that marque's suggestion list. */}
      {filters.brand.length > 0 && (
        <Group title={t('مدل', 'Model')} open>
          <BrandModelPicker
            brandSlug={filters.brand[0] ?? ''}
            value={filters.model ?? ''}
            onChange={(model) => set({ model })}
          />
        </Group>
      )}

      {category === 'motorcycle' && (
        <Group title={t('نوع موتور', 'Bike type')} open>
          <PillGroup>
          {BIKE_TYPES.map((type) => (
            <PillOption
              key={type.key}
              checked={filters.bikeType.includes(type.key as SearchFilters['bikeType'][number])}
              label={t(type.label)}
              count={countFor(pool, {
                ...filters,
                bikeType: [type.key as SearchFilters['bikeType'][number]],
              })}
              onToggle={() =>
                set({
                  bikeType: toggle(filters.bikeType, type.key as SearchFilters['bikeType'][number]),
                })
              }
            />
          ))}
          </PillGroup>
        </Group>
      )}

      {category === 'heavy' && (
        <Group title={t('نوع ماشین‌آلات', 'Machinery type')} open>
          <PillGroup>
          {HEAVY_TYPES.map((type) => (
            <PillOption
              key={type.key}
              checked={filters.heavyType.includes(type.key as SearchFilters['heavyType'][number])}
              label={t(type.label)}
              count={countFor(pool, {
                ...filters,
                heavyType: [type.key as SearchFilters['heavyType'][number]],
              })}
              onToggle={() =>
                set({
                  heavyType: toggle(
                    filters.heavyType,
                    type.key as SearchFilters['heavyType'][number],
                  ),
                })
              }
            />
          ))}
          </PillGroup>
        </Group>
      )}

      <Group title={t('وضعیت خودرو', 'Vehicle condition')} open>
        <PillGroup>
        {conditions.map((condition) => (
          <PillOption
            key={condition}
            checked={filters.condition.includes(condition)}
            label={t(CONDITION_LABELS[condition])}
            count={countFor(pool, { ...filters, condition: [condition] })}
            onToggle={() => set({ condition: toggle(filters.condition, condition) })}
          />
        ))}
        </PillGroup>
      </Group>

      {/* Declared condition groups — the same values the seller fills on /new. */}
      <Group title={t('بیمه شخص ثالث و بدنه', 'Insurance')}>
        <PillGroup>
        {insuranceKinds.map((kind) => (
          <PillOption
            key={kind}
            checked={filters.insurance.includes(kind)}
            label={t(`${INSURANCE_KIND_LABELS[kind]} دارد`, `${t(INSURANCE_KIND_LABELS[kind])} included`)}
            count={countFor(pool, { ...filters, insurance: [kind] })}
            onToggle={() => set({ insurance: toggle(filters.insurance, kind) })}
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('وضعیت رنگ و بدنه', 'Paint & body')}>
        <PillGroup>
        {paintConditions.map((paint) => (
          <PillOption
            key={paint}
            checked={filters.paintCondition.includes(paint)}
            label={t(PAINT_CONDITION_LABELS[paint])}
            count={countFor(pool, { ...filters, paintCondition: [paint] })}
            onToggle={() => set({ paintCondition: toggle(filters.paintCondition, paint) })}
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('وضعیت شاسی', 'Chassis condition')}>
        <PillGroup>
        {chassisConditions.map((chassis) => (
          <PillOption
            key={chassis}
            checked={filters.chassisCondition.includes(chassis)}
            label={t(CHASSIS_CONDITION_LABELS[chassis])}
            count={countFor(pool, { ...filters, chassisCondition: [chassis] })}
            onToggle={() => set({ chassisCondition: toggle(filters.chassisCondition, chassis) })}
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('معاینه فنی / برگه کارشناسی', 'Technical inspection')}>
        <PillGroup>
        {(
          [
            { key: 'yes' as const, label: 'دارد' },
            { key: 'no' as const, label: 'ندارد' },
          ]
        ).map((option) => (
          <PillOption
            key={option.key}
            checked={filters.technicalInspection === option.key}
            label={t(option.label)}
            onToggle={() =>
              set({
                technicalInspection:
                  filters.technicalInspection === option.key ? undefined : option.key,
              })
            }
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('گیربکس', 'Gearbox')}>
        <PillGroup>
        {gearboxTypes.map((gearbox) => (
          <PillOption
            key={gearbox}
            checked={filters.gearbox.includes(gearbox)}
            label={t(GEARBOX_LABELS[gearbox])}
            count={countFor(pool, { ...filters, gearbox: [gearbox] })}
            onToggle={() => set({ gearbox: toggle(filters.gearbox, gearbox) })}
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('سوخت', 'Fuel')}>
        <PillGroup>
        {fuelTypes.map((fuel) => (
          <PillOption
            key={fuel}
            checked={filters.fuel.includes(fuel)}
            label={t(FUEL_LABELS[fuel])}
            count={countFor(pool, { ...filters, fuel: [fuel] })}
            onToggle={() => set({ fuel: toggle(filters.fuel, fuel) })}
          />
        ))}
        </PillGroup>
      </Group>

      <Group title={t('وضعیت پلاک', 'Plate status')}>
        <PillGroup>
        {plateTypes.map((plate) => (
          <PillOption
            key={plate}
            checked={filters.plateType.includes(plate)}
            label={t(PLATE_TYPE_LABELS[plate])}
            count={countFor(pool, { ...filters, plateType: [plate] })}
            onToggle={() => set({ plateType: toggle(filters.plateType, plate) })}
          />
        ))}
        </PillGroup>
      </Group>
    </div>
  );
}

/**
 * Filter drawer — the same groups, applied on «نمایش N آگهی».
 *
 * It is the one filter surface at every width (see FilterDrawerShell): on a
 * phone it is a slide-over with a scrim, on desktop it slides in from the
 * right while the listing grid stays visible beside it.
 */
export function FilterDrawer({
  open,
  category,
  filters,
  pool,
  onApply,
  onClear,
  onClose,
  variant = 'drawer',
}: {
  open: boolean;
  category: VehicleCategory;
  filters: SearchFilters;
  pool: readonly FilterableListing[];
  onApply: (next: SearchFilters) => void;
  onClear: () => void;
  onClose: () => void;
  /** `sidebar` is the desktop column beside the grid; `drawer` is mobile. */
  variant?: 'drawer' | 'sidebar';
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);


  const clearDraft = () =>
    setDraft((current) => ({
      ...current,
      brand: [],
      model: '',
      trim: '',
      yearFrom: undefined,
      yearTo: undefined,
      priceFrom: undefined,
      priceTo: undefined,
      mileageMin: undefined,
      mileageMax: undefined,
      insurance: [],
      paintCondition: [],
      chassisCondition: [],
      technicalInspection: undefined,
      gearbox: [],
      fuel: [],
      plateType: [],
      condition: [],
      city: [],
      engineCcMin: undefined,
      engineCcMax: undefined,
      bikeType: [],
      heavyType: [],
      workingHoursMax: undefined,
      hasReport: false,
      kishOnly: false,
    }));

  const count = countMatches(pool, draft);

  return (
    <FilterDrawerShell
      open={open}
      variant={variant}
      title={t('فیلترها', 'Filters')}
      closeLabel={t('بستن فیلترها', 'Close filters')}
      clearLabel={t('پاک کردن همه', 'Clear all')}
      applyLabel={t(`نمایش ${count} آگهی`, `Show ${count} ads`)}
      onClear={() => {
        clearDraft();
        onClear();
      }}
      onApply={() => onApply(draft)}
      onClose={onClose}
    >
      <FilterGroups category={category} filters={draft} onChange={setDraft} pool={pool} />
    </FilterDrawerShell>
  );
}

/**
 * Mobile control row: the one «فیلترها» button, the new/used picks and the
 * live result count. The brand row lives in the emblem carousel above, so this
 * strip never repeats the same marques as a second row of pills.
 */
export function FilterBar({
  filters,
  pool,
  onOpen,
}: {
  category: VehicleCategory;
  filters: SearchFilters;
  pool: readonly FilterableListing[];
  onOpen: () => void;
  onChange: (next: SearchFilters) => void;
}) {
  const { t } = useI18n();
  const active =
    filters.brand.length +
    filters.gearbox.length +
    filters.fuel.length +
    filters.plateType.length +
    filters.condition.length +
    filters.city.length +
    filters.bikeType.length +
    filters.heavyType.length +
    (filters.model ? 1 : 0) +
    (filters.trim ? 1 : 0) +
    (filters.yearFrom !== undefined || filters.yearTo !== undefined ? 1 : 0) +
    (filters.priceFrom !== undefined || filters.priceTo !== undefined ? 1 : 0) +
    (filters.mileageMin !== undefined || filters.mileageMax !== undefined ? 1 : 0) +
    (filters.insurance.length ? 1 : 0) +
    (filters.paintCondition.length ? 1 : 0) +
    (filters.chassisCondition.length ? 1 : 0) +
    (filters.technicalInspection !== undefined ? 1 : 0) +
    (filters.engineCcMin !== undefined || filters.engineCcMax !== undefined ? 1 : 0) +
    (filters.workingHoursMax !== undefined ? 1 : 0);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-2 text-xs font-extrabold text-ink transition hover:border-line-strong"
      >
        <Icon name="sliders" size={15} />
        {t('فیلترها', 'Filters')}
        {active > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
            {active}
          </span>
        )}
      </button>
      {/* Live count kept for assistive tech without adding another visible
          chip row; the visible count lives in the catalog control bar. */}
      <span className="sr-only" aria-live="polite">
        {countMatches(pool, filters)} آگهی
      </span>
    </div>
  );
}

