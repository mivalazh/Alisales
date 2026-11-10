'use client';

import { useState } from 'react';
import { PLAN_PREVIEWS, PLAN_PREVIEW_SOON, toPersianDigits } from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';

const PLAN_EN: Record<string, { name: string; features: readonly string[] }> = {
  personal: {
    name: 'Personal plan',
    features: ['Up to 5 active listings', '30-day visibility', 'One bump per day'],
  },
  showroom: {
    name: 'Showroom & workshop plan',
    features: [
      'Up to 50 active listings',
      '90-day visibility',
      'Up to 3 bumps per day',
      'Stories',
      'Full analytics',
    ],
  },
};

/**
 * Plan preview at the third-listing gate.
 *
 * Cards are read-only: price shows «بزودی», «انتخاب پلن» only reveals the
 * «بزودی» notice. Nothing is sent to a payment provider — there is no checkout
 * code in this project and `subscriptions` stays off.
 */
export function PlanPreview() {
  const { t, lang } = useI18n();
  const [notice, setNotice] = useState(false);

  return (
    <section
      className="rounded-card border border-line bg-card p-4 sm:p-5"
      aria-label={t('پلن‌ها', 'Plans')}
    >
      <h2 className="text-md font-extrabold">{t('پلن‌های اشتراک', 'Subscription plans')}</h2>
      <p className="mt-1 text-xs text-muted">
        {t(
          'برای انتشار آگهی سوم، یکی از پلن‌ها را انتخاب کنید. پرداخت هنوز فعال نشده است.',
          'Choose a plan to publish your third listing. Payments are not live yet.',
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PLAN_PREVIEWS.map((plan) => (
          <article
            key={plan.code}
            className="flex flex-col rounded-card border border-line bg-page p-4"
          >
            <h3 className="text-sm font-extrabold">
              {lang === 'en' ? (PLAN_EN[plan.code]?.name ?? plan.name) : plan.name}
            </h3>
            <p className="mt-1 text-lg font-extrabold text-note">
              {t(PLAN_PREVIEW_SOON, 'Coming soon')}
            </p>
            <ul className="mt-3 flex-1 space-y-1 text-xs font-semibold text-muted">
              {(lang === 'en' ? (PLAN_EN[plan.code]?.features ?? plan.features) : plan.features).map((feature) => (
                <li key={feature} className="flex items-start gap-1.5">
                  <span aria-hidden="true">•</span>
                  {feature}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-faint">
              {lang === 'en'
                ? `${plan.durationDays} days · up to ${plan.listingLimit} active listings`
                : `${toPersianDigits(plan.durationDays)} روزه · تا ${toPersianDigits(plan.listingLimit)} آگهی فعال`}
            </p>
            <button
              type="button"
              onClick={() => setNotice(true)}
              className="mt-3 rounded-[var(--radius-pill)] border border-line bg-card px-3 py-2 text-xs font-extrabold text-ink transition hover:border-line-strong"
            >
              {t('انتخاب پلن', 'Choose plan')}
            </button>
          </article>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className="mt-3 rounded-field border border-line bg-cta-soft px-4 py-3 text-sm font-bold"
        >
          {t(
            `${PLAN_PREVIEW_SOON} — پرداخت و فعال‌سازی پلن‌ها هنوز راه‌اندازی نشده است.`,
            'Coming soon — plan payments and activation are not available yet.',
          )}
        </p>
      )}
    </section>
  );
}
