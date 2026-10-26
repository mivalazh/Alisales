'use client';

import {
  BRAND_LABELS,
  CITY_LABELS,
  CONDITION_LABELS,
  GEARBOX_LABELS,
  PLATE_TYPE_LABELS,
  activeFilterCount,
  groupDigits,
  toPersianDigits,
  type SearchFilters,
} from '@alisales/schemas';
import { Icon } from './Icon';

interface Chip {
  id: string;
  label: string;
  clear: (f: SearchFilters) => SearchFilters;
}

function rangeLabel(label: string, from?: number, to?: number): string | null {
  if (from === undefined && to === undefined) return null;
  if (from !== undefined && to !== undefined) return `${label}: ${toPersianDigits(from)} تا ${toPersianDigits(to)}`;
  if (from !== undefined) return `${label}: از ${toPersianDigits(from)}`;
  return `${label}: تا ${toPersianDigits(to!)}`;
}

/** One removable chip per active filter — the buyer sees exactly what's on. */
export function FilterChips({
  filters,
  onChange,
}: {
  filters: SearchFilters;
  onChange: (f: SearchFilters) => void;
}) {
  if (activeFilterCount(filters) === 0) return null;

  const chips: Chip[] = [];
  for (const brand of filters.brand) {
    chips.push({
      id: `brand-${brand}`,
      label: BRAND_LABELS[brand] ?? brand,
      clear: (f) => ({ ...f, brand: f.brand.filter((b) => b !== brand) }),
    });
  }
  if (filters.model) {
    const model = filters.model;
    chips.push({ id: 'model', label: `مدل: ${model}`, clear: (f) => ({ ...f, model: '' }) });
  }
  const year = rangeLabel('سال', filters.yearFrom, filters.yearTo);
  if (year) {
    chips.push({
      id: 'year',
      label: year,
      clear: (f) => ({ ...f, yearFrom: undefined, yearTo: undefined }),
    });
  }
  const price = rangeLabel('قیمت (ریال)', filters.priceFrom, filters.priceTo);
  if (price) {
    chips.push({
      id: 'price',
      label: price,
      clear: (f) => ({ ...f, priceFrom: undefined, priceTo: undefined }),
    });
  }
  if (filters.mileageMax !== undefined) {
    const max = filters.mileageMax;
    chips.push({
      id: 'mileage',
      label: `کارکرد تا ${groupDigits(max)} کیلومتر`,
      clear: (f) => ({ ...f, mileageMax: undefined }),
    });
  }
  for (const gearbox of filters.gearbox) {
    chips.push({
      id: `gearbox-${gearbox}`,
      label: GEARBOX_LABELS[gearbox],
      clear: (f) => ({ ...f, gearbox: f.gearbox.filter((g) => g !== gearbox) }),
    });
  }
  for (const plate of filters.plateType) {
    chips.push({
      id: `plate-${plate}`,
      label: PLATE_TYPE_LABELS[plate],
      clear: (f) => ({ ...f, plateType: f.plateType.filter((p) => p !== plate) }),
    });
  }
  for (const condition of filters.condition) {
    chips.push({
      id: `condition-${condition}`,
      label: CONDITION_LABELS[condition],
      clear: (f) => ({ ...f, condition: f.condition.filter((c) => c !== condition) }),
    });
  }
  for (const city of filters.city) {
    chips.push({
      id: `city-${city}`,
      label: CITY_LABELS[city] ?? city,
      clear: (f) => ({ ...f, city: f.city.filter((c) => c !== city) }),
    });
  }
  if (filters.hasReport) {
    chips.push({ id: 'hasReport', label: 'دارای گزارش بازرسی', clear: (f) => ({ ...f, hasReport: false }) });
  }
  if (filters.kishOnly) {
    chips.push({ id: 'kishOnly', label: 'فقط پلاک کیش', clear: (f) => ({ ...f, kishOnly: false }) });
  }
  if (filters.q) {
    chips.push({ id: 'q', label: `جستجو: ${filters.q}`, clear: (f) => ({ ...f, q: '' }) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.clear(filters))}
          className="flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-line bg-cta-soft px-3 py-1.5 text-xs font-bold text-ink transition hover:border-line-strong"
        >
          {chip.label}
          <Icon name="close" size={14} />
          <span className="sr-only">حذف فیلتر</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({
            ...filters,
            brand: [],
            model: '',
            yearFrom: undefined,
            yearTo: undefined,
            priceFrom: undefined,
            priceTo: undefined,
            mileageMax: undefined,
            gearbox: [],
            plateType: [],
            condition: [],
            city: [],
            hasReport: false,
            kishOnly: false,
            q: '',
          })
        }
        className="text-xs font-bold text-muted underline transition hover:text-ink"
      >
        حذف همه
      </button>
    </div>
  );
}
