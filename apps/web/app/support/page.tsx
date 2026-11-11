import { localizedMetadata } from '@/lib/i18n/metadata';
import { Icon } from '@/components/Icon';
import { SupportForm } from '@/components/SupportForm';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'تماس با پشتیبانی' },
  { title: 'Contact support' },
);

const MAP_URL =
  'https://www.openstreetmap.org/?mlat=26.5579&mlon=53.9800#map=13/26.5579/53.9800';

export default async function SupportPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold text-cta">{t('پشتیبانی و همکاری', 'Support & partnerships')}</p>
          <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">{t('چطور می‌توانیم کمک کنیم؟', 'How can we help?')}</h1>
          <p className="mt-1 max-w-xl text-sm leading-7 text-muted">
            {t(
              'برای گزارش آگهی، مشکل ورود یا شروع همکاری، همین‌جا پیام بگذارید؛ درخواست شما با شماره پیگیری ثبت می‌شود.',
              'Report a listing, resolve a sign-in issue or start a partnership here; every request gets a reference number.',
            )}
          </p>
        </div>
        <a href="#partnership" className="text-xs font-bold text-cta underline">
          {t('پیشنهاد همکاری یا برند جدید', 'Suggest a partnership or brand')}
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-start">
        <SupportForm kind="ticket" />

        <aside id="partnership" className="scroll-mt-24 space-y-3">
          <section className="rounded-card border border-[#F98513]/35 bg-[#FFF7EC] p-5 dark:bg-[#2a2418]">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F98513] text-white">
                <Icon name="badgeCheck" size={18} />
              </span>
              {t('همکاری با ما', 'Partner with us')}
            </p>
            <p className="mt-2 text-xs leading-6 text-ink/80">
              {t(
                'نمایشگاه‌داران، تامین‌کنندگان قطعات و همکاران تجاری می‌توانند برای حضور در Ali Sales و پورتال رنت با ما همکاری کنند.',
                'Showrooms, parts suppliers and commercial partners can work with us across Ali Sales and the rental portal.',
              )}
            </p>
            <a
              href="mailto:partners@alisales.ir?subject=Partnership%20with%20Ali%20Sales"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111144] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#1b1b57]"
            >
              {t('شروع گفتگوی همکاری', 'Start a partnership conversation')}
              <Icon name="arrowLeft" size={14} />
            </a>
          </section>

          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-xs font-extrabold text-ink">{t('پیش از ارسال پیام', 'Before you send')}</p>
            <p className="mt-1 text-[11px] leading-6 text-muted">
              {t(
                'شناسه آگهی یا شماره موبایل حساب خود را بنویسید تا سریع‌تر پیدا کنیم.',
                'Include the listing reference or your account mobile number so we can find it faster.',
              )}
            </p>
          </div>
        </aside>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: 'phone' as const,
            label: t('تلفن پشتیبانی', 'Support phone'),
            value: '0936 000 0000',
            href: 'tel:+989360000000',
            ltr: true,
          },
          {
            icon: 'message' as const,
            label: t('ایمیل رسمی', 'Official email'),
            value: 'support@alisales.ir',
            href: 'mailto:support@alisales.ir',
            ltr: true,
          },
          {
            icon: 'pin' as const,
            label: t('آدرس تعمیرگاه', 'Workshop address'),
            value: t('کیش، تعمیرگاه تخصصی شمس‌اله', 'Shamsollah Specialist Workshop, Kish'),
            href: MAP_URL,
            ltr: false,
          },
        ].map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            target={tile.href.startsWith('http') ? '_blank' : undefined}
            rel={tile.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="rounded-card border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cta-soft text-cta">
              <Icon name={tile.icon} size={17} />
            </span>
            <p className="mt-2 text-[10px] font-bold text-muted">{tile.label}</p>
            <p
              className="mt-1 break-words text-sm font-extrabold text-ink"
              dir={tile.ltr ? 'ltr' : undefined}
            >
              {tile.value}
            </p>
          </a>
        ))}
      </section>

      <a
        href={MAP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('نمایش موقعیت تعمیرگاه روی نقشه کیش', 'Open the workshop location on the Kish map')}
        className="group relative block h-48 overflow-hidden rounded-card border border-line bg-[#dff3ea] shadow-sm transition hover:shadow-md sm:h-56 dark:bg-[#132e2b]"
      >
        <span className="absolute inset-0 opacity-80 [background-image:linear-gradient(30deg,transparent_46%,rgba(255,255,255,0.75)_47%,rgba(255,255,255,0.75)_49%,transparent_50%),linear-gradient(-25deg,transparent_44%,rgba(255,255,255,0.65)_45%,rgba(255,255,255,0.65)_47%,transparent_48%),radial-gradient(circle_at_70%_35%,#c7eadb_0,transparent_42%)] [background-size:150px_150px,190px_190px,auto]" />
        <span className="absolute inset-x-5 top-1/2 h-1.5 -translate-y-1/2 rotate-[-8deg] rounded-full bg-[#8ecdb9]/70" />
        <span className="absolute inset-y-6 start-1/3 w-1.5 rotate-[18deg] rounded-full bg-[#8ecdb9]/70" />
        <span className="absolute start-1/2 top-[42%] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[#F98513] text-white shadow-lg transition group-hover:scale-105">
          <Icon name="pin" size={22} />
        </span>
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-[#111144]/85 to-transparent px-4 pb-4 pt-10 text-white">
          <span>
            <span className="block text-sm font-extrabold">{t('موقعیت تعمیرگاه شمس‌اله', 'Shamsollah Workshop location')}</span>
            <span className="mt-0.5 block text-[11px] text-white/75">{t('کیش، جزیره کیش — نمایش روی نقشه', 'Kish Island — open interactive map')}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold backdrop-blur">
            {t('نقشه کیش', 'Kish map')}
          </span>
        </span>
      </a>
    </article>
  );
}
