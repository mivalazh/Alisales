'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useModalFocus } from '@/lib/useModalFocus';
import { Icon, type IconName } from './Icon';

/** The safe-trade guide's name, shared by its card, its dialog and the
 *  assistant's «مشاهده راهنمای خرید» landing (`/support?guide=safe-buy`). */
const SAFE_BUY = { titleFa: 'خرید و فروش امن در کیش', titleEn: 'Safe buying and selling in Kish' } as const;

/** A card either opens the safe-trade dialog or navigates somewhere. */
type GuideCard = {
  titleFa: string;
  titleEn: string;
  icon: IconName;
  tone: string;
} & ({ guide: 'safe-buy' } | { href: string });

const GUIDES: ReadonlyArray<GuideCard> = [
  {
    ...SAFE_BUY,
    guide: 'safe-buy',
    icon: 'shieldCheck',
    tone: 'bg-[#F98513]/12 text-[#F98513]',
  },
  {
    titleFa: 'ثبت آگهی در چند دقیقه',
    titleEn: 'Post a listing in minutes',
    href: '/new',
    icon: 'camera',
    tone: 'bg-[#223382]/10 text-[#223382] dark:text-[#9BACD8]',
  },
  {
    titleFa: 'پلاک کیش، گذر موقت و مدارک',
    titleEn: 'Kish plates, temporary transit and paperwork',
    href: '/terms',
    icon: 'plate',
    tone: 'bg-[#0F7FC4]/12 text-[#0F7FC4]',
  },
  {
    titleFa: 'پیگیری تیکت و گزارش آگهی مشکوک',
    titleEn: 'Ticket tracking and reporting a listing',
    href: '/support#ticket',
    icon: 'message',
    tone: 'bg-[#DEF434]/25 text-[#111144] dark:text-[#DEF434]',
  },
];

const SAFE_BUY_STEPS: ReadonlyArray<{ titleFa: string; titleEn: string; bodyFa: string; bodyEn: string }> = [
  {
    titleFa: '۱. حضوری ببینید',
    titleEn: '1. View it in person',
    bodyFa: 'خودرو را در روشنایی روز و در محل فروشنده ببینید؛ عکس و ویدیو جای بازدید حضوری را نمی‌گیرد.',
    bodyEn: 'See the vehicle in daylight at the seller’s location; photos and videos are no substitute for a visit.',
  },
  {
    titleFa: '۲. کارشناسی شاسی و بدنه',
    titleEn: '2. Inspect chassis and body',
    bodyFa: 'شاسی پلمپ جلو و عقب، دوررنگ و تعویض استوک را با کارشناسی حضوری یا برگه معتبر بررسی کنید.',
    bodyEn: 'Check the front and rear chassis seals, repainting and replaced panels with an in-person inspection or a valid report.',
  },
  {
    titleFa: '۳. سند، شاسی و VIN',
    titleEn: '3. Documents, chassis and VIN',
    bodyFa: 'شماره شاسی و VIN باید با سند و مشخصات آگهی یکی باشد؛ مغایرت را قبل از پرداخت حل کنید.',
    bodyEn: 'The chassis number and VIN must match the documents and the listing; resolve any mismatch before paying.',
  },
  {
    titleFa: '۴. پلاک کیش و گذر موقت',
    titleEn: '4. Kish plate and temporary transit',
    bodyFa: 'وضعیت پلاک منطقه آزاد یا مهلت گذر موقت، عوارض گمرکی و مالیات منطقه را کتبی بگیرید.',
    bodyEn: 'Get the free-zone plate status or transit deadline, customs duties and zone taxes in writing.',
  },
  {
    titleFa: '۵. بیمه و معاینه فنی',
    titleEn: '5. Insurance and technical inspection',
    bodyFa: 'باقی‌مانده بیمه شخص ثالث و بدنه و اعتبار معاینه فنی را ببینید؛ تمدید نزدیک، هزینه‌ی خرید است.',
    bodyEn: 'Check the remaining third-party and body insurance and a valid inspection; an imminent renewal is part of the price.',
  },
  {
    titleFa: '۶. پرداخت و بیع‌نامه',
    titleEn: '6. Payment and bill of sale',
    bodyFa: 'پرداخت را در حضور و با بیع‌نامه‌ی مکتوب انجام دهید و شماره حساب را با نام صاحب سند تطبیق دهید.',
    bodyEn: 'Pay in person with a written bill of sale, and match the account name to the registered owner.',
  },
];

const CARD_CLASS =
  'group flex min-h-[132px] flex-col justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm';

function CardBody({ guide }: { guide: GuideCard }) {
  const { t, lang } = useI18n();
  return (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${guide.tone}`}>
        <Icon name={guide.icon} size={16} />
      </span>
      <p className="line-clamp-3 text-xs font-extrabold leading-5 text-ink sm:text-sm sm:leading-6">
        {lang === 'en' ? guide.titleEn : guide.titleFa}
      </p>
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-cta sm:text-[11px]">
        {t('خواندن راهنما', 'Read guide')} <Icon name="arrowLeft" size={12} />
      </span>
    </>
  );
}

/**
 * «راهنمای کاربردی» — four compact guide cards.
 *
 * Phones get a 2×2 grid and the cards keep a fixed 132px rhythm instead of a
 * square: icon, title and «خواندن راهنما» are spaced by `gap-3`, so no card
 * carries a giant vertical blank between its parts. From `sm` up the same four
 * cards become one row.
 *
 * The first card opens the safe-trade guide in a dialog. `/support?guide=safe-buy`
 * (the assistant's «مشاهده راهنمای خرید» target) opens it on arrival.
 */
export function SupportHelpCenter({ initialGuide = null }: { initialGuide?: 'safe-buy' | null }) {
  const { t, lang } = useI18n();
  const [guideOpen, setGuideOpen] = useState(initialGuide === 'safe-buy');
  // The dialog is a portal into <body>, which only exists on the client.
  const [mounted, setMounted] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const safeBuyTitle = lang === 'en' ? SAFE_BUY.titleEn : SAFE_BUY.titleFa;

  useEffect(() => setMounted(true), []);

  const closeGuide = () => {
    setGuideOpen(false);
    // Drop the query so a refresh or a shared link does not re-open the sheet.
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState(null, '', '/support');
    }
  };

  // `mounted` is part of `active`: the dialog only exists after the portal's
  // first client render, and a focus effect that ran one frame earlier would
  // find no container and leave focus behind the inert page.
  useModalFocus({ active: guideOpen && mounted, containerRef: dialog, onClose: closeGuide });

  useEffect(() => {
    if (!guideOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [guideOpen]);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink sm:text-xl">
        {t('راهنمای کاربردی', 'Practical guides')}
      </h2>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {GUIDES.map((guide) =>
          'href' in guide ? (
            <Link key={guide.titleFa} href={guide.href} className={CARD_CLASS}>
              <CardBody guide={guide} />
            </Link>
          ) : (
            <button
              key={guide.titleFa}
              type="button"
              onClick={() => setGuideOpen(true)}
              className={`${CARD_CLASS} text-start`}
            >
              <CardBody guide={guide} />
            </button>
          ),
        )}
      </div>

      {mounted && guideOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-[#111144]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
              onClick={closeGuide}
            >
              <div
                ref={dialog}
                role="dialog"
                aria-modal="true"
                aria-label={safeBuyTitle}
                tabIndex={-1}
                className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-page p-4 shadow-2xl sm:rounded-2xl sm:p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-extrabold text-ink">{safeBuyTitle}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {t(
                        'شش قدم برای معامله‌ای بی‌دردسر در بازار کیش.',
                        'Six steps to a hassle-free deal in the Kish market.',
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeGuide}
                    aria-label={t('بستن', 'Close')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted transition hover:text-ink"
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>

                <ol className="space-y-2.5">
                  {SAFE_BUY_STEPS.map((step) => (
                    <li key={step.titleFa} className="rounded-xl border border-line bg-card p-3">
                      <p className="text-sm font-extrabold text-ink">
                        {lang === 'en' ? step.titleEn : step.titleFa}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted">
                        {lang === 'en' ? step.bodyEn : step.bodyFa}
                      </p>
                    </li>
                  ))}
                </ol>

                <Link
                  href="/cars"
                  onClick={closeGuide}
                  className="btn-cta mt-4 flex w-full text-sm"
                >
                  {t('دیدن خودروهای فعال', 'Browse active vehicles')}
                </Link>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
