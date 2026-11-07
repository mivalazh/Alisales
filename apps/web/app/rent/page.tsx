import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CITY_LABELS } from '@alisales/schemas';
import { Icon } from '@/components/Icon';
import { allRentals, tomanLabel } from '@/lib/rentals';

export const metadata: Metadata = {
  title: 'رنت خودرو و موتور در کیش',
  description:
    'اجاره خودرو و اسکوتر برقی در کیش با نرخ روزانه، هفتگی و ماهانه، تحویل در فرودگاه و هتل و شرایط ودیعه‌ی شفاف — پورتال رنت Ali Sales.',
};

const TABS = [
  { key: '', label: 'همه' },
  { key: 'car', label: 'خودرو' },
  { key: 'scooter', label: 'اسکوتر برقی' },
] as const;

/**
 * «رنت خودرو و موتور» — a sister experience inside Ali Sales.
 *
 * Deliberately its own visual identity (deep emerald + warm sand gold) and its
 * own data store: rental ads have no sale price, plate or mileage, so they
 * never enter the classifieds feed. The header pill is the only bridge.
 */
export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const selected = kind === 'car' || kind === 'scooter' ? kind : '';
  const rentals = allRentals().filter((rental) => !selected || rental.kind === selected);

  return (
    <div className="-mx-4 -mt-6 bg-[#F6F4EE] pb-10 sm:-mx-6 lg:-my-8 dark:bg-[#0d1512]">
      <section className="bg-gradient-to-br from-[#064E3B] via-[#065f46] to-[#047857] px-4 py-8 text-white sm:px-6 sm:py-10">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#FCD9A0]">
          Ali Sales Rent
        </p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">رنت خودرو و موتور در کیش</h1>
        <p className="mt-2 max-w-xl text-sm leading-7 text-white/85">
          ناوگان لوکس و اسکوترهای برقی، با نرخ روزانه، هفتگی و ماهانه، تحویل در فرودگاه یا
          هتل. شرایط ودیعه از قبل مشخص است — بدون هزینه‌ی پنهان.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/rent/new"
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[#D97706] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#b45309]"
          >
            <Icon name="plus" size={17} />
            ثبت آگهی اجاره
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-white/30 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-white/10"
          >
            🚗 بازگشت به خرید و فروش
          </Link>
        </div>
      </section>

      <div className="px-4 pt-5 sm:px-6">
        <nav aria-label="نوع رنت" className="flex gap-1.5">
          {TABS.map((tab) => {
            const active = selected === tab.key;
            return (
              <Link
                key={tab.key || 'all'}
                href={tab.key ? `/rent?kind=${tab.key}` : '/rent'}
                aria-current={active ? 'page' : undefined}
                className={`rounded-[var(--radius-pill)] border px-4 py-2 text-xs font-extrabold transition ${
                  active
                    ? 'border-[#064E3B] bg-[#064E3B] text-white dark:border-[#047857] dark:bg-[#047857]'
                    : 'border-[#064E3B]/20 bg-white text-[#064E3B] hover:border-[#064E3B]/40 dark:border-white/15 dark:bg-white/5 dark:text-white/80'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rentals.map((rental) => (
            <li
              key={rental.slug}
              className="overflow-hidden rounded-2xl border border-[#064E3B]/15 bg-white shadow-sm transition hover:shadow-lg dark:border-white/10 dark:bg-[#12211c]"
            >
              <div className="relative aspect-[16/10] bg-[#e8e3d8]">
                <Image
                  src={rental.imageUrl}
                  alt={rental.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute top-2 start-2 rounded-[var(--radius-pill)] bg-[#D97706] px-2.5 py-1 text-[10px] font-extrabold text-white">
                  {rental.kind === 'scooter' ? 'اسکوتر برقی' : 'خودرو'}
                </span>
              </div>

              <div className="space-y-2 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#064E3B]/60 dark:text-[#FCD9A0]/70">
                  {rental.brand}
                </p>
                <h2 className="line-clamp-2 text-sm font-extrabold leading-6 text-[#0b2e24] dark:text-white">
                  {rental.title}
                </h2>
                <p className="flex items-center gap-1 text-[11px] font-bold text-[#0b2e24]/60 dark:text-white/60">
                  <Icon name="pin" size={12} />
                  {CITY_LABELS[rental.city] ?? rental.city} · {rental.agency}
                </p>

                <div className="grid grid-cols-3 gap-1.5 border-y border-[#064E3B]/10 py-2 text-center dark:border-white/10">
                  {[
                    { label: 'روزانه', value: rental.dailyIRR },
                    { label: 'هفتگی', value: rental.weeklyIRR },
                    { label: 'ماهانه', value: rental.monthlyIRR },
                  ].map((rate) => (
                    <div key={rate.label}>
                      <p className="text-[9px] font-bold text-[#0b2e24]/50 dark:text-white/50">
                        {rate.label}
                      </p>
                      <p className="mt-0.5 text-[11px] font-extrabold tabular-nums text-[#D97706]">
                        {tomanLabel(rate.value)}
                      </p>
                    </div>
                  ))}
                </div>

                <ul className="flex flex-wrap gap-1">
                  {rental.delivery.map((option) => (
                    <li
                      key={option}
                      className="rounded-[var(--radius-pill)] bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#065f46] dark:bg-[#064E3B]/40 dark:text-[#A7F3D0]"
                    >
                      {option}
                    </li>
                  ))}
                  <li className="rounded-[var(--radius-pill)] bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-bold text-[#92400E] dark:bg-[#D97706]/25 dark:text-[#FDE68A]">
                    حداقل سن {rental.minAge}
                  </li>
                </ul>

                <p className="line-clamp-2 text-[11px] leading-5 text-[#0b2e24]/65 dark:text-white/60">
                  {rental.depositNote}
                </p>

                <Link
                  href={`/support?topic=rent&ref=${encodeURIComponent(rental.slug)}`}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-[#064E3B] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-[#047857]"
                >
                  درخواست رزرو
                  <Icon name="chevronLeft" size={14} />
                </Link>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-2xl border border-dashed border-[#064E3B]/25 bg-white/60 px-4 py-3 text-center text-xs font-bold leading-6 text-[#064E3B]/70 dark:border-white/15 dark:bg-white/5 dark:text-white/60">
          آژانس یا نمایشگاه دارید؟ ناوگان‌تان را رایگان در پورتال رنت ثبت کنید تا مسافران
          کیش از همان ابتدا آن را ببینند.
        </p>
      </div>
    </div>
  );
}
