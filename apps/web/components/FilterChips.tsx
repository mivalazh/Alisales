'use client';

import {
  BIKE_TYPE_LABELS,
  BODY_TYPE_LABELS,
  BRAND_LABELS,
  CITY_LABELS,
  CONDITION_LABELS,
  FUEL_LABELS,
  GEARBOX_LABELS,
  HEAVY_TYPE_LABELS,
  PLATE_TYPE_LABELS,
  PAINT_CONDITION_LABELS,
  CHASSIS_CONDITION_LABELS,
  INSURANCE_KIND_LABELS,
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
  for (const body of filters.bodyType) {
    chips.push({
      id: `body-${body}`,
      label: BODY_TYPE_LABELS[body],
      clear: (f) => ({ ...f, bodyType: f.bodyType.filter((v) => v !== body) }),
    });
  }
  if (filters.model) {
    const model = filters.model;
    chips.push({ id: 'model', label: `مدل: ${model}`, clear: (f) => ({ ...f, model: '' }) });
  }
  if (filters.trim) {
    chips.push({ id: 'trim', label: `تیپ: ${filters.trim}`, clear: (f) => ({ ...f, trim: '' }) });
  }
  const year = rangeLabel('سال', filters.yearFrom, filters.yearTo);
  if (year) {
    chips.push({
      id: 'year',
      label: year,
      clear: (f) => ({ ...f, yearFrom: undefined, yearTo: undefined }),
    });
  }
  const price = rangeLabel('قیمت (تومان / درهم)', filters.priceFrom, filters.priceTo);
  if (price) {
    chips.push({
      id: 'price',
      label: price,
      clear: (f) => ({ ...f, priceFrom: undefined, priceTo: undefined }),
    });
  }
  if (filters.mileageMin !== undefined || filters.mileageMax !== undefined) {
    const from = filters.mileageMin;
    const max = filters.mileageMax;
    chips.push({
      id: 'mileage',
      label:
        from !== undefined && max !== undefined
          ? `کارکرد ${groupDigits(from)} تا ${groupDigits(max)} کیلومتر`
          : from !== undefined
            ? `کارکرد از ${groupDigits(from)} کیلومتر`
            : `کارکرد تا ${groupDigits(max!)} کیلومتر`,
      clear: (f) => ({ ...f, mileageMin: undefined, mileageMax: undefined }),
    });
  }
  for (const kind of filters.insurance) {
    chips.push({
      id: `insurance-${kind}`,
      label: `${INSURANCE_KIND_LABELS[kind]} دارد`,
      clear: (f) => ({ ...f, insurance: f.insurance.filter((v) => v !== kind) }),
    });
  }
  for (const paint of filters.paintCondition) {
    chips.push({
      id: `paint-${paint}`,
      label: PAINT_CONDITION_LABELS[paint],
      clear: (f) => ({ ...f, paintCondition: f.paintCondition.filter((v) => v !== paint) }),
    });
  }
  for (const chassis of filters.chassisCondition) {
    chips.push({
      id: `chassis-${chassis}`,
      label: CHASSIS_CONDITION_LABELS[chassis],
      clear: (f) => ({ ...f, chassisCondition: f.chassisCondition.filter((v) => v !== chassis) }),
    });
  }
  if (filters.technicalInspection) {
    chips.push({
      id: 'technicalInspection',
      label: `معاینه فنی: ${filters.technicalInspection === 'yes' ? 'دارد' : 'ندارد'}`,
      clear: (f) => ({ ...f, technicalInspection: undefined }),
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
  for (const fuel of filters.fuel) {
    chips.push({
      id: `fuel-${fuel}`,
      label: FUEL_LABELS[fuel],
      clear: (f) => ({ ...f, fuel: f.fuel.filter((v) => v !== fuel) }),
    });
  }
  for (const bike of filters.bikeType) {
    chips.push({
      id: `bike-${bike}`,
      label: BIKE_TYPE_LABELS[bike] ?? bike,
      clear: (f) => ({ ...f, bikeType: f.bikeType.filter((v) => v !== bike) }),
    });
  }
  for (const heavy of filters.heavyType) {
    chips.push({
      id: `heavy-${heavy}`,
      label: HEAVY_TYPE_LABELS[heavy] ?? heavy,
      clear: (f) => ({ ...f, heavyType: f.heavyType.filter((v) => v !== heavy) }),
    });
  }
  const cc = rangeLabel('حجم موتور', filters.engineCcMin, filters.engineCcMax);
  if (cc) {
    chips.push({
      id: 'engineCc',
      label: `${cc} cc`,
      clear: (f) => ({ ...f, engineCcMin: undefined, engineCcMax: undefined }),
    });
  }
  if (filters.workingHoursMax !== undefined) {
    chips.push({
      id: 'workingHours',
      label: `ساعت کارکرد تا ${toPersianDigits(groupDigits(filters.workingHoursMax))}`,
      clear: (f) => ({ ...f, workingHoursMax: undefined }),
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
    chips.push({ id: 'kishOnly', label: 'فقط پلاک منطقه آزاد', clear: (f) => ({ ...f, kishOnly: false }) });
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
            bodyType: [],
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
