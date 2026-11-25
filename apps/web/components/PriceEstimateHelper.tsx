'use client';

import { useEffect, useState } from 'react';
import { formatAmountLatin, irrToToman, type VehicleCategory } from '@alisales/schemas';
import { Icon } from './Icon';
import { useI18n } from '@/lib/i18n';

interface Estimate {
  ok?: boolean;
  source: 'comparables' | 'brand' | 'none';
  count: number;
  minIRR: number | null;
  avgIRR: number | null;
  maxIRR: number | null;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; estimate: Estimate }
  | { status: 'error' };

/**
 * «قیمت پیشنهادی بازار» — a subtle helper under the price field.
 *
 * It asks `/api/price-estimate` for the catalogue's own comparables whenever
 * brand, model, year or plate class changes (debounced, one request in flight),
 * and stays silent until the fields that make a comparable meaningful are
 * filled in. A missing range is a normal answer, never an error banner.
 */
export function PriceEstimateHelper({
  brand,
  model,
  year,
  plateType,
  category,
}: {
  brand: string;
  model: string;
  year: string;
  plateType: string;
  category: VehicleCategory;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ status: 'idle' });

  const ready = Boolean(brand && brand !== 'other' && model.trim() && year);

  useEffect(() => {
    if (!ready) {
      setState({ status: 'idle' });
      return;
    }
    const controller = new AbortController();
    setState({ status: 'loading' });
    const params = new URLSearchParams({ category, brand, model: model.trim(), year });
    if (plateType) params.set('plateType', plateType);

    // Typing a model letter by letter must not fire one request per keystroke.
    const timer = window.setTimeout(() => {
      fetch(`/api/price-estimate?${params}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error(`price estimate ${res.status}`);
          setState({ status: 'ready', estimate: (await res.json()) as Estimate });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ status: 'error' });
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [brand, model, year, plateType, category, ready]);

  if (!ready) return null;

  const toman = (irr: number) => formatAmountLatin(irrToToman(irr));

  return (
    <div
      className="col-span-full rounded-field border border-dashed border-line bg-page px-3 py-2"
      aria-live="polite"
    >
      <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink">
        <Icon name="tag" size={14} className="text-cta" />
        {t('قیمت پیشنهادی بازار', 'Suggested market price')}
      </p>

      {state.status === 'loading' && (
        <p className="mt-1 text-[11px] font-bold text-muted">
          {t('در حال بررسی آگهی‌های مشابه…', 'Checking comparable listings…')}
        </p>
      )}

      {state.status === 'error' && (
        <p className="mt-1 text-[11px] font-bold text-muted">
          {t(
            'فعلاً نمی‌توانیم بازه قیمت را نشان دهیم؛ قیمت خودتان را وارد کنید.',
            'We cannot show a range right now; enter your own price.',
          )}
        </p>
      )}

      {state.status === 'ready' && state.estimate.source === 'none' && (
        <p className="mt-1 text-[11px] font-bold leading-5 text-muted">
          {t(
            'هنوز آگهی مشابهی برای این خودرو ثبت نشده است؛ قیمت را بر اساس وضعیت واقعی خودرو وارد کنید.',
            'No comparable listing has been posted for this vehicle yet; price it on its actual condition.',
          )}
        </p>
      )}

      {state.status === 'ready' &&
        state.estimate.source !== 'none' &&
        state.estimate.minIRR !== null &&
        state.estimate.maxIRR !== null &&
        state.estimate.avgIRR !== null && (
          <>
            <p className="mt-1 text-xs font-extrabold text-ink" dir="ltr">
              {toman(state.estimate.minIRR)} – {toman(state.estimate.maxIRR)} {t('تومان')}
            </p>
            <p className="mt-0.5 text-[11px] font-bold leading-5 text-muted">
              {t(
                `میانگین ${toman(state.estimate.avgIRR)} تومان · بر اساس ${formatAmountLatin(state.estimate.count)} آگهی ${
                  state.estimate.source === 'comparables' ? 'مشابه' : 'هم‌برند'
                }`,
                `Average ${toman(state.estimate.avgIRR)} Toman · based on ${formatAmountLatin(
                  state.estimate.count,
                )} ${state.estimate.source === 'comparables' ? 'comparable' : 'same-brand'} listings`,
              )}
            </p>
          </>
        )}
    </div>
  );
}
