'use client';

import {
  CONDITION_LABELS,
  kishUiBrands,
  conditions,
  gearboxTypes,
  GEARBOX_LABELS,
  PLATE_TYPE_LABELS,
  plateTypes,
  selectableCities,
  toAsciiDigits,
  type SearchFilters,
} from '@alisales/schemas';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function intOrNull(raw: string): number | undefined {
  const ascii = toAsciiDigits(raw).replace(/[^\d]/g, '');
  if (!ascii) return undefined;
  const n = Number.parseInt(ascii, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * One filter choice — the same compact tag the category pages use: orange
 * (brand accent) when active, quiet cream when not, no checkbox chrome.
 */
function PillChoice({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`inline-flex min-h-8 items-center rounded-full border px-2.5 py-1 text-[11px] leading-tight transition active:scale-[0.98] ${
        checked
          ? 'border-[#F98513] bg-[#F98513] font-bold text-[#111144] shadow-xs'
          : 'border-slate-200/80 bg-[#F4F1EC] font-medium text-slate-700 hover:border-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20'
      }`}
    >
      {label}
    </button>
  );
}

function PillRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-extrabold text-ink">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Home-page filter panel.
 *
 * Two placements, one filter set:
 *  • `sidebar` (desktop, from `lg`): a narrow right-hand column beside the
 *    grid, so opening «فیلترها» narrows the results instead of covering or
 *    pushing them away. Same header («پاک کردن همه») and compact orange pill
 *    tags as the category drawer on `/cars`.
 *  • `inline` (phones/tablets): a card above the grid — there is no room for
 *    a column there.
 *
 * Every control writes into the shared SearchFilters object; the Catalog
 * commits it to the URL (the server re-runs the one search).
 */
export function FilterPanel({
  filters,
  onChange,
  onClear,
  onClose,
  variant = 'inline',
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  /** «پاک کردن همه» — clears every filter, keeping the search term. */
  onClear: () => void;
  onClose: () => void;
  variant?: 'inline' | 'sidebar';
}) {
  const { t } = useI18n();
  const cities = selectableCities();
  const sidebar = variant === 'sidebar';

  return (
    <div
      className={`rounded-card border border-line bg-card ${
        sidebar
          ? // Fits under the sticky offset (8.5rem) with a 1rem gap at the bottom.
            'flex max-h-[calc(100dvh-9.5rem)] flex-col p-3.5'
          : 'p-4 sm:p-5'
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-extrabold text-ink">
          <Icon name="sliders" size={16} />
          {t('فیلترها', 'Filters')}
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-full bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink transition hover:bg-cta hover:text-white"
        >
          {t('پاک کردن همه', 'Clear all')}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('بستن فیلترها', 'Close filters')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div
        className={`min-h-0 ${
          sidebar
            ? 'flex-1 space-y-3.5 overflow-y-auto pe-1'
            : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
        }`}
      >
        <Section title={t('برند', 'Brand')}>
          <PillRow>
            {kishUiBrands.map((b) => (
              <PillChoice
                key={b.slug}
                checked={filters.brand.includes(b.slug)}
                label={b.latin}
                onToggle={() => onChange({ ...filters, brand: toggle(filters.brand, b.slug) })}
              />
            ))}
          </PillRow>
        </Section>

        <Section title={t('مدل', 'Model')}>
          <input
            className="field text-xs"
            value={filters.model}
            onChange={(e) => onChange({ ...filters, model: e.target.value })}
            placeholder={t('مثلاً لندکروزر', 'e.g. Land Cruiser')}
            aria-label={t('مدل', 'Model')}
          />
        </Section>

        <Section title={t('سال ساخت', 'Model year')}>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="field text-xs"
              inputMode="numeric"
              value={filters.yearFrom ?? ''}
              onChange={(e) => onChange({ ...filters, yearFrom: intOrNull(e.target.value) })}
              placeholder={t('از', 'From')}
              aria-label={t('سال از', 'Year from')}
            />
            <input
              className="field text-xs"
              inputMode="numeric"
              value={filters.yearTo ?? ''}
              onChange={(e) => onChange({ ...filters, yearTo: intOrNull(e.target.value) })}
              placeholder={t('تا', 'To')}
              aria-label={t('سال تا', 'Year to')}
            />
          </div>
        </Section>

        <Section title={t('قیمت (تومان / درهم)', 'Price (Toman / AED)')}>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="field text-xs"
              inputMode="numeric"
              value={filters.priceFrom ?? ''}
              onChange={(e) => onChange({ ...filters, priceFrom: intOrNull(e.target.value) })}
              placeholder={t('از', 'From')}
              aria-label={t('قیمت از', 'Price from')}
            />
            <input
              className="field text-xs"
              inputMode="numeric"
              value={filters.priceTo ?? ''}
              onChange={(e) => onChange({ ...filters, priceTo: intOrNull(e.target.value) })}
              placeholder={t('تا', 'To')}
              aria-label={t('قیمت تا', 'Price to')}
            />
          </div>
        </Section>

        <Section title={t('حداکثر کارکرد (کیلومتر)', 'Max mileage (km)')}>
          <input
            className="field text-xs"
            inputMode="numeric"
            value={filters.mileageMax ?? ''}
            onChange={(e) => onChange({ ...filters, mileageMax: intOrNull(e.target.value) })}
            placeholder={t('مثلاً ۵۰۰۰۰', 'e.g. 50,000')}
            aria-label={t('حداکثر کارکرد', 'Max mileage')}
          />
        </Section>

        <Section title={t('گیربکس', 'Gearbox')}>
          <PillRow>
            {gearboxTypes.map((g) => (
              <PillChoice
                key={g}
                checked={filters.gearbox.includes(g)}
                label={GEARBOX_LABELS[g]}
                onToggle={() => onChange({ ...filters, gearbox: toggle(filters.gearbox, g) })}
              />
            ))}
          </PillRow>
        </Section>

        <Section title={t('وضعیت پلاک', 'Plate status')}>
          <PillRow>
            {plateTypes.map((p) => (
              <PillChoice
                key={p}
                checked={filters.plateType.includes(p)}
                label={PLATE_TYPE_LABELS[p]}
                onToggle={() => onChange({ ...filters, plateType: toggle(filters.plateType, p) })}
              />
            ))}
          </PillRow>
        </Section>

        <Section title={t('نوع خودرو', 'Vehicle type')}>
          <PillRow>
            {conditions.map((c) => (
              <PillChoice
                key={c}
                checked={filters.condition.includes(c)}
                label={CONDITION_LABELS[c]}
                onToggle={() => onChange({ ...filters, condition: toggle(filters.condition, c) })}
              />
            ))}
          </PillRow>
        </Section>

        <Section title={t('شهر', 'City')}>
          <PillRow>
            {cities.map((c) => (
              <PillChoice
                key={c.slug}
                checked={filters.city.includes(c.slug)}
                label={c.label}
                onToggle={() => onChange({ ...filters, city: toggle(filters.city, c.slug) })}
              />
            ))}
          </PillRow>
        </Section>

        <Section title={t('سایر', 'Other')}>
          <PillRow>
            <PillChoice
              checked={filters.hasReport}
              label={t('دارای گزارش بازرسی', 'Has inspection report')}
              onToggle={() => onChange({ ...filters, hasReport: !filters.hasReport })}
            />
            <PillChoice
              checked={filters.kishOnly}
              label={t('فقط پلاک منطقه آزاد', 'Free-zone plate only')}
              onToggle={() => onChange({ ...filters, kishOnly: !filters.kishOnly })}
            />
          </PillRow>
        </Section>
      </div>
    </div>
  );
}
