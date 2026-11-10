'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  BIKE_TYPES,
  CITY_LABELS,
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
  selectableCities,
  toAsciiDigits,
  tomanToIRR,
  type SearchFilters,
  type VehicleCategory,
} from '@alisales/schemas';
import { countMatches, matchesFilters, type FilterableListing } from '@/lib/filter-match';
import { RateLine } from './RateLine';
import { Icon } from './Icon';
import { CustomSelect } from './CustomSelect';
import { useI18n } from '@/lib/i18n';

/**
 * The filter system for the vehicle pages.
 *
 * Desktop: a left sidebar of collapsible groups, each option carrying its live
 * result count (computed with the same predicate the server search uses, so a
 * count can never disagree with the grid).
 *
 * Mobile: one «فیلترها» button opens a bottom sheet with those same groups, a
 * sticky footer showing «نمایش N آگهی» and «پاک کردن همه».
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
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1 text-sm font-extrabold text-ink">
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

function CheckOption({
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
    <label className="flex cursor-pointer items-center gap-2 rounded-field py-1 text-sm font-semibold text-muted transition hover:text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 accent-[var(--color-accent)]"
      />
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-[11px] tabular-nums text-faint">{count}</span>}
    </label>
  );
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
  const active = from !== undefined || to !== undefined;
  // «تا سال» defaults to the current latest model year. It is a display
  // default until the buyer actually picks a second year, so the URL is not
  // rewritten with a yearTo=2026 filter on every page load.
  const toDisplay = to ?? LATEST_VEHICLE_YEAR;

  const pick = (year: number) => {
    // No range yet (or the previous range is complete) → start a new one.
    if (from === undefined || (from !== undefined && to !== undefined)) {
      onChange({ yearFrom: year, yearTo: LATEST_VEHICLE_YEAR });
      return;
    }
    if (year < from) {
      onChange({ yearFrom: year, yearTo: from });
      return;
    }
    onChange({ yearFrom: from, yearTo: year });
  };

  const inRange = (year: number) =>
    from !== undefined && to !== undefined && year >= Math.min(from, to) && year <= Math.max(from, to);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-between gap-2 rounded-field border px-3 py-2 text-xs font-bold transition ${
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
          <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-extrabold">
            <span className="text-muted">
              از سال:{' '}
              <b className="text-ink">{from !== undefined ? from : '—'}</b>
            </span>
            <span className="text-muted">
              تا سال: <b className="text-ink">{toDisplay}</b>
            </span>
            {active && (
              <button
                type="button"
                onClick={() => onChange({ yearFrom: undefined, yearTo: undefined })}
                className="text-cta underline"
              >
                پاک کردن
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {GRID_YEARS.map((year) => {
              const isFrom = year === from;
              const isTo = year === to;
              const selected = inRange(year) || isFrom || isTo;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => pick(year)}
                  aria-pressed={selected}
                  className={`rounded-field border py-1.5 text-xs font-extrabold tabular-nums transition ${
                    selected
                      ? 'border-[#F98513] bg-[#F98513] text-white'
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
          className="field h-9 text-xs"
          inputMode="numeric"
          value={from ?? ''}
          onChange={(e) => onFrom(intOrUndefined(e.target.value))}
          placeholder={placeholderFrom}
          aria-label={`${label} از`}
        />
        <input
          className="field h-9 text-xs"
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
        className="field h-9 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('یا نام مدل را بنویسید…', 'Or type the model name...')}
        aria-label={t('جستجوی مدل', 'Search model')}
      />
    </div>
  );
}

/** Every group of the filter set, shared by the sidebar and the mobile sheet. */
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
            className="field h-9 text-xs"
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
            className="field h-9 text-xs"
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
            className="field h-9 text-xs"
            inputMode="numeric"
            value={filters.mileageMin !== undefined ? filters.mileageMin.toLocaleString('en-US') : ''}
            onChange={(e) => set({ mileageMin: intOrUndefined(e.target.value) })}
            placeholder={t('از … کیلومتر', 'From … km')}
            aria-label={t('کارکرد از', 'Mileage from')}
          />
          <input
            className="field h-9 text-xs"
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
            className="field h-9 text-xs"
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
          className="field h-9 text-xs"
          value={brandQuery}
          onChange={(e) => setBrandQuery(e.target.value)}
          placeholder={t('جستجوی برند…', 'Search brands...')}
          aria-label={t('جستجوی برند در فیلتر', 'Search brands in filters')}
        />
        <div className="mt-1">
          {visibleBrands.map((brand) => (
            <CheckOption
              key={brand.slug}
              checked={filters.brand.includes(brand.slug as SearchFilters['brand'][number])}
              label={t(brand.label)}
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
        </div>
        {!q && brands.length > 8 && (
          <button
            type="button"
            onClick={() => setShowAllBrands((v) => !v)}
            className="mt-1 text-[11px] font-bold text-cta underline"
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
          {BIKE_TYPES.map((type) => (
            <CheckOption
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
        </Group>
      )}

      {category === 'heavy' && (
        <Group title={t('نوع ماشین‌آلات', 'Machinery type')} open>
          {HEAVY_TYPES.map((type) => (
            <CheckOption
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
        </Group>
      )}

      <Group title={t('وضعیت خودرو', 'Vehicle condition')} open>
        {conditions.map((condition) => (
          <CheckOption
            key={condition}
            checked={filters.condition.includes(condition)}
            label={t(CONDITION_LABELS[condition])}
            count={countFor(pool, { ...filters, condition: [condition] })}
            onToggle={() => set({ condition: toggle(filters.condition, condition) })}
          />
        ))}
      </Group>

      {/* Declared condition groups — the same values the seller fills on /new. */}
      <Group title={t('بیمه شخص ثالث و بدنه', 'Insurance')}>
        {insuranceKinds.map((kind) => (
          <CheckOption
            key={kind}
            checked={filters.insurance.includes(kind)}
            label={t(`${INSURANCE_KIND_LABELS[kind]} دارد`, `${t(INSURANCE_KIND_LABELS[kind])} included`)}
            count={countFor(pool, { ...filters, insurance: [kind] })}
            onToggle={() => set({ insurance: toggle(filters.insurance, kind) })}
          />
        ))}
      </Group>

      <Group title={t('وضعیت رنگ و بدنه', 'Paint & body')}>
        {paintConditions.map((paint) => (
          <CheckOption
            key={paint}
            checked={filters.paintCondition.includes(paint)}
            label={t(PAINT_CONDITION_LABELS[paint])}
            count={countFor(pool, { ...filters, paintCondition: [paint] })}
            onToggle={() => set({ paintCondition: toggle(filters.paintCondition, paint) })}
          />
        ))}
      </Group>

      <Group title={t('وضعیت شاسی', 'Chassis condition')}>
        {chassisConditions.map((chassis) => (
          <CheckOption
            key={chassis}
            checked={filters.chassisCondition.includes(chassis)}
            label={t(CHASSIS_CONDITION_LABELS[chassis])}
            count={countFor(pool, { ...filters, chassisCondition: [chassis] })}
            onToggle={() => set({ chassisCondition: toggle(filters.chassisCondition, chassis) })}
          />
        ))}
      </Group>

      <Group title={t('معاینه فنی / برگه کارشناسی', 'Technical inspection')}>
        {(
          [
            { key: 'yes' as const, label: 'دارد' },
            { key: 'no' as const, label: 'ندارد' },
          ]
        ).map((option) => (
          <CheckOption
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
      </Group>

      <Group title={t('گیربکس', 'Gearbox')}>
        {gearboxTypes.map((gearbox) => (
          <CheckOption
            key={gearbox}
            checked={filters.gearbox.includes(gearbox)}
            label={t(GEARBOX_LABELS[gearbox])}
            count={countFor(pool, { ...filters, gearbox: [gearbox] })}
            onToggle={() => set({ gearbox: toggle(filters.gearbox, gearbox) })}
          />
        ))}
      </Group>

      <Group title={t('سوخت', 'Fuel')}>
        {fuelTypes.map((fuel) => (
          <CheckOption
            key={fuel}
            checked={filters.fuel.includes(fuel)}
            label={t(FUEL_LABELS[fuel])}
            count={countFor(pool, { ...filters, fuel: [fuel] })}
            onToggle={() => set({ fuel: toggle(filters.fuel, fuel) })}
          />
        ))}
      </Group>

      <Group title={t('وضعیت پلاک', 'Plate status')}>
        {plateTypes.map((plate) => (
          <CheckOption
            key={plate}
            checked={filters.plateType.includes(plate)}
            label={t(PLATE_TYPE_LABELS[plate])}
            count={countFor(pool, { ...filters, plateType: [plate] })}
            onToggle={() => set({ plateType: toggle(filters.plateType, plate) })}
          />
        ))}
      </Group>

      <Group title={t('شهر', 'City')}>
        {selectableCities().map((city) => (
          <CheckOption
            key={city.slug}
            checked={filters.city.includes(city.slug as SearchFilters['city'][number])}
            label={t(CITY_LABELS[city.slug] ?? city.label)}
            onToggle={() =>
              set({ city: toggle(filters.city, city.slug as SearchFilters['city'][number]) })
            }
          />
        ))}
      </Group>

      <Group title={t('سایر', 'Other')}>
        <CheckOption
          checked={filters.hasReport}
          label={t('دارای گزارش بازرسی', 'Has inspection report')}
          onToggle={() => set({ hasReport: !filters.hasReport })}
        />
        <CheckOption
          checked={filters.kishOnly}
          label={t('فقط پلاک منطقه آزاد', 'Free-zone plate only')}
          onToggle={() => set({ kishOnly: !filters.kishOnly })}
        />
      </Group>
    </div>
  );
}

/** Desktop sidebar — sticky, scrollable, with the result count on top. */
export function FilterSidebar({
  category,
  filters,
  onChange,
  onClear,
  pool,
}: {
  category: VehicleCategory;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onClear: () => void;
  pool: readonly FilterableListing[];
}) {
  const { t } = useI18n();
  const count = countMatches(pool, filters);
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-card border border-line bg-card p-3">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
            <Icon name="sliders" size={16} className="text-cta" />
            {t('فیلترها', 'Filters')}
          </h2>
          <span className="rounded-[var(--radius-pill)] bg-cta-soft px-2 py-0.5 text-[11px] font-extrabold text-ink">
            {count} {t('آگهی', 'ads')}
          </span>
        </div>
        <FilterGroups category={category} filters={filters} onChange={onChange} pool={pool} />
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full rounded-field border border-line py-2 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink"
        >
          {t('پاک کردن همه', 'Clear all')}
        </button>
      </div>
    </aside>
  );
}

/** Mobile bottom sheet — the same groups, applied on «نمایش N آگهی». */
export function FilterSheet({
  open,
  category,
  filters,
  pool,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean;
  category: VehicleCategory;
  filters: SearchFilters;
  pool: readonly FilterableListing[];
  onApply: (next: SearchFilters) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<SearchFilters>(filters);

  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  const count = countMatches(pool, draft);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('فیلترها', 'Filters')}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:hidden"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-card border border-line bg-page"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-extrabold">{t('فیلترها', 'Filters')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('بستن فیلترها', 'Close filters')}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          <FilterGroups
            category={category}
            filters={draft}
            onChange={setDraft}
            pool={pool}
          />
        </div>

        <div
          className="flex items-center gap-2 border-t border-line bg-card px-4 py-3"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => {
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
              onClear();
            }}
            className="text-xs font-bold text-muted underline"
          >
            {t('پاک کردن همه', 'Clear all')}
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="btn-cta ms-auto text-sm"
          >
            {t(`نمایش ${count} آگهی`, `Show ${count} ads`)}
          </button>
        </div>
      </div>
    </div>
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
    <div className="flex items-center gap-2 lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-2 text-xs font-extrabold text-ink transition hover:border-line-strong"
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

/** Kept for callers that need a single boolean. */
export function hasActiveFilters(filters: SearchFilters, pool: readonly FilterableListing[]): boolean {
  return pool.some((listing) => matchesFilters(listing, filters));
}
