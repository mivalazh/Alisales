'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  BIKE_TYPES,
  CITY_LABELS,
  CONDITION_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  HEAVY_TYPES,
  PLATE_TYPE_LABELS,
  brandsForCategory,
  conditions,
  fuelTypes,
  gearboxTypes,
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
      <Group title="قیمت (تومان)" open>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="field h-9 text-xs"
            inputMode="numeric"
            value={filters.priceFrom !== undefined ? irrToToman(filters.priceFrom) : ''}
            onChange={(e) => {
              const n = intOrUndefined(e.target.value);
              set({ priceFrom: n === undefined ? undefined : tomanToIRR(n) });
            }}
            placeholder="از"
            aria-label="قیمت از"
          />
          <input
            className="field h-9 text-xs"
            inputMode="numeric"
            value={filters.priceTo !== undefined ? irrToToman(filters.priceTo) : ''}
            onChange={(e) => {
              const n = intOrUndefined(e.target.value);
              set({ priceTo: n === undefined ? undefined : tomanToIRR(n) });
            }}
            placeholder="تا"
            aria-label="قیمت تا"
          />
        </div>
        <div className="mt-1">
          <RateLine />
        </div>
      </Group>

      <Group title="سال ساخت (میلادی)" open>
        <RangePair
          label="بازه‌ی سال (میلادی)"
          from={filters.yearFrom}
          to={filters.yearTo}
          onFrom={(v) => set({ yearFrom: v })}
          onTo={(v) => set({ yearTo: v })}
        />
      </Group>

      <Group title={category === 'heavy' ? 'کارکرد (کیلومتر)' : 'حداکثر کارکرد'} open>
        <input
          className="field h-9 text-xs"
          inputMode="numeric"
          value={filters.mileageMax ?? ''}
          onChange={(e) => set({ mileageMax: intOrUndefined(e.target.value) })}
          placeholder="مثلاً ۱۰۰٬۰۰۰ کیلومتر"
          aria-label="حداکثر کارکرد"
        />
      </Group>

      {category === 'motorcycle' && (
        <Group title="حجم موتور (cc)" open>
          <RangePair
            label="بازه‌ی حجم"
            from={filters.engineCcMin}
            to={filters.engineCcMax}
            onFrom={(v) => set({ engineCcMin: v })}
            onTo={(v) => set({ engineCcMax: v })}
          />
        </Group>
      )}

      {category === 'heavy' && (
        <Group title="ساعت کارکرد" open>
          <input
            className="field h-9 text-xs"
            inputMode="numeric"
            value={filters.workingHoursMax ?? ''}
            onChange={(e) => set({ workingHoursMax: intOrUndefined(e.target.value) })}
            placeholder="حداکثر ساعت کارکرد"
            aria-label="حداکثر ساعت کارکرد"
          />
        </Group>
      )}

      <Group title="برند" open>
        <input
          className="field h-9 text-xs"
          value={brandQuery}
          onChange={(e) => setBrandQuery(e.target.value)}
          placeholder="جستجوی برند…"
          aria-label="جستجوی برند در فیلتر"
        />
        <div className="mt-1">
          {visibleBrands.map((brand) => (
            <CheckOption
              key={brand.slug}
              checked={filters.brand.includes(brand.slug as SearchFilters['brand'][number])}
              label={brand.label}
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
            {showAllBrands ? 'نمایش کمتر' : `نمایش همه‌ی ${brands.length} برند`}
          </button>
        )}
      </Group>

      {category === 'motorcycle' && (
        <Group title="نوع موتورسیکلت" open>
          {BIKE_TYPES.map((type) => (
            <CheckOption
              key={type.key}
              checked={filters.bikeType.includes(type.key as SearchFilters['bikeType'][number])}
              label={type.label}
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
        <Group title="نوع ماشین‌آلات" open>
          {HEAVY_TYPES.map((type) => (
            <CheckOption
              key={type.key}
              checked={filters.heavyType.includes(type.key as SearchFilters['heavyType'][number])}
              label={type.label}
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

      <Group title="وضعیت خودرو" open>
        {conditions.map((condition) => (
          <CheckOption
            key={condition}
            checked={filters.condition.includes(condition)}
            label={CONDITION_LABELS[condition]}
            count={countFor(pool, { ...filters, condition: [condition] })}
            onToggle={() => set({ condition: toggle(filters.condition, condition) })}
          />
        ))}
      </Group>

      <Group title="گیربکس">
        {gearboxTypes.map((gearbox) => (
          <CheckOption
            key={gearbox}
            checked={filters.gearbox.includes(gearbox)}
            label={GEARBOX_LABELS[gearbox]}
            count={countFor(pool, { ...filters, gearbox: [gearbox] })}
            onToggle={() => set({ gearbox: toggle(filters.gearbox, gearbox) })}
          />
        ))}
      </Group>

      <Group title="سوخت">
        {fuelTypes.map((fuel) => (
          <CheckOption
            key={fuel}
            checked={filters.fuel.includes(fuel)}
            label={FUEL_LABELS[fuel]}
            count={countFor(pool, { ...filters, fuel: [fuel] })}
            onToggle={() => set({ fuel: toggle(filters.fuel, fuel) })}
          />
        ))}
      </Group>

      <Group title="وضعیت پلاک">
        {plateTypes.map((plate) => (
          <CheckOption
            key={plate}
            checked={filters.plateType.includes(plate)}
            label={PLATE_TYPE_LABELS[plate]}
            count={countFor(pool, { ...filters, plateType: [plate] })}
            onToggle={() => set({ plateType: toggle(filters.plateType, plate) })}
          />
        ))}
      </Group>

      <Group title="شهر">
        {selectableCities().map((city) => (
          <CheckOption
            key={city.slug}
            checked={filters.city.includes(city.slug as SearchFilters['city'][number])}
            label={CITY_LABELS[city.slug] ?? city.label}
            onToggle={() =>
              set({ city: toggle(filters.city, city.slug as SearchFilters['city'][number]) })
            }
          />
        ))}
      </Group>

      <Group title="سایر">
        <CheckOption
          checked={filters.hasReport}
          label="دارای گزارش بازرسی"
          onToggle={() => set({ hasReport: !filters.hasReport })}
        />
        <CheckOption
          checked={filters.kishOnly}
          label="فقط پلاک کیش"
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
  const count = countMatches(pool, filters);
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-card border border-line bg-card p-3">
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold">
            <Icon name="sliders" size={16} className="text-cta" />
            فیلترها
          </h2>
          <span className="rounded-[var(--radius-pill)] bg-cta-soft px-2 py-0.5 text-[11px] font-extrabold text-ink">
            {count} آگهی
          </span>
        </div>
        <FilterGroups category={category} filters={filters} onChange={onChange} pool={pool} />
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full rounded-field border border-line py-2 text-xs font-bold text-muted transition hover:border-line-strong hover:text-ink"
        >
          پاک کردن همه
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
      aria-label="فیلترها"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:hidden"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-card border border-line bg-page"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-extrabold">فیلترها</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن فیلترها"
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
                mileageMax: undefined,
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
            پاک کردن همه
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="btn-cta ms-auto text-sm"
          >
            نمایش {count} آگهی
          </button>
        </div>
      </div>
    </div>
  );
}

/** Mobile control row: the one «فیلترها» button plus quick condition picks. */
export function FilterBar({
  category,
  filters,
  pool,
  onOpen,
  onChange,
}: {
  category: VehicleCategory;
  filters: SearchFilters;
  pool: readonly FilterableListing[];
  onOpen: () => void;
  onChange: (next: SearchFilters) => void;
}) {
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
    (filters.mileageMax !== undefined ? 1 : 0) +
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
        فیلترها
        {active > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-extrabold text-[color:var(--color-text-on-accent)]">
            {active}
          </span>
        )}
      </button>

      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {(['new', 'used'] as const).map((key) => {
          const on = filters.condition.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onChange({
                  ...filters,
                  condition: toggle(filters.condition, key),
                })
              }
              className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-bold transition ${
                on
                  ? 'border-cta bg-cta-soft text-ink'
                  : 'border-line bg-card text-muted hover:text-ink'
              }`}
            >
              {CONDITION_LABELS[key]}
            </button>
          );
        })}
        {brandsForCategory(category)
          .slice(0, 6)
          .map((brand) => {
            const slug = brand.slug as SearchFilters['brand'][number];
            const on = filters.brand.includes(slug);
            return (
              <button
                key={brand.slug}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...filters, brand: toggle(filters.brand, slug) })}
                className={`shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border px-3 py-1.5 text-xs font-bold transition ${
                  on
                    ? 'border-cta bg-cta-soft text-ink'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {brand.label}
              </button>
            );
          })}
        <span className="shrink-0 whitespace-nowrap px-2 text-[11px] font-bold text-faint">
          {countMatches(pool, filters)} آگهی
        </span>
      </div>
    </div>
  );
}

/** Kept for callers that need a single boolean. */
export function hasActiveFilters(filters: SearchFilters, pool: readonly FilterableListing[]): boolean {
  return pool.some((listing) => matchesFilters(listing, filters));
}
