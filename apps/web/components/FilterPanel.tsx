'use client';

import {
  BRANDS,
  CONDITION_LABELS,
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

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function intOrNull(raw: string): number | undefined {
  const ascii = toAsciiDigits(raw).replace(/[^\d]/g, '');
  if (!ascii) return undefined;
  const n = Number.parseInt(ascii, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Checkbox group used by brand/gearbox/plate/condition sections. */
function CheckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

/**
 * Full filter drawer — every control writes into the shared SearchFilters
 * object; the Catalog commits it to the URL (server re-runs the one search).
 */
export function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onClose: () => void;
}) {
  const cities = selectableCities();

  return (
    <div className="rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <Icon name="sliders" size={18} />
          فیلترها
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن فیلترها"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <section>
          <h3 className="mb-1 text-sm font-extrabold text-ink">برند</h3>
          {BRANDS.map((b) => (
            <CheckRow
              key={b.slug}
              checked={filters.brand.includes(b.slug)}
              label={b.label}
              onToggle={() => onChange({ ...filters, brand: toggle(filters.brand, b.slug) })}
            />
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">مدل</h3>
            <input
              className="field"
              value={filters.model}
              onChange={(e) => onChange({ ...filters, model: e.target.value })}
              placeholder="مثلاً کوییک"
              aria-label="مدل"
            />
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">سال ساخت</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field"
                inputMode="numeric"
                value={filters.yearFrom ?? ''}
                onChange={(e) => onChange({ ...filters, yearFrom: intOrNull(e.target.value) })}
                placeholder="از"
                aria-label="سال از"
              />
              <input
                className="field"
                inputMode="numeric"
                value={filters.yearTo ?? ''}
                onChange={(e) => onChange({ ...filters, yearTo: intOrNull(e.target.value) })}
                placeholder="تا"
                aria-label="سال تا"
              />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">قیمت (ریال)</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                className="field"
                inputMode="numeric"
                value={filters.priceFrom ?? ''}
                onChange={(e) => onChange({ ...filters, priceFrom: intOrNull(e.target.value) })}
                placeholder="از"
                aria-label="قیمت از"
              />
              <input
                className="field"
                inputMode="numeric"
                value={filters.priceTo ?? ''}
                onChange={(e) => onChange({ ...filters, priceTo: intOrNull(e.target.value) })}
                placeholder="تا"
                aria-label="قیمت تا"
              />
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">حداکثر کارکرد (کیلومتر)</h3>
            <input
              className="field"
              inputMode="numeric"
              value={filters.mileageMax ?? ''}
              onChange={(e) => onChange({ ...filters, mileageMax: intOrNull(e.target.value) })}
              placeholder="مثلاً ۵۰۰۰۰"
              aria-label="حداکثر کارکرد"
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">گیربکس</h3>
            {gearboxTypes.map((g) => (
              <CheckRow
                key={g}
                checked={filters.gearbox.includes(g)}
                label={GEARBOX_LABELS[g]}
                onToggle={() => onChange({ ...filters, gearbox: toggle(filters.gearbox, g) })}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">وضعیت پلاک</h3>
            {plateTypes.map((p) => (
              <CheckRow
                key={p}
                checked={filters.plateType.includes(p)}
                label={PLATE_TYPE_LABELS[p]}
                onToggle={() => onChange({ ...filters, plateType: toggle(filters.plateType, p) })}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">نوع خودرو</h3>
            {conditions.map((c) => (
              <CheckRow
                key={c}
                checked={filters.condition.includes(c)}
                label={CONDITION_LABELS[c]}
                onToggle={() => onChange({ ...filters, condition: toggle(filters.condition, c) })}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">شهر</h3>
            {cities.map((c) => (
              <CheckRow
                key={c.slug}
                checked={filters.city.includes(c.slug)}
                label={c.label}
                onToggle={() => onChange({ ...filters, city: toggle(filters.city, c.slug) })}
              />
            ))}
          </div>

          <div>
            <h3 className="mb-1 text-sm font-extrabold text-ink">سایر</h3>
            <CheckRow
              checked={filters.hasReport}
              label="دارای گزارش بازرسی"
              onToggle={() => onChange({ ...filters, hasReport: !filters.hasReport })}
            />
            <CheckRow
              checked={filters.kishOnly}
              label="فقط پلاک کیش"
              onToggle={() => onChange({ ...filters, kishOnly: !filters.kishOnly })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
