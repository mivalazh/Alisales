import { localizedMetadata } from '@/lib/i18n/metadata';
import { Icon } from '@/components/Icon';
import { MyTickets } from '@/components/MyTickets';
import { SupportForm } from '@/components/SupportForm';
import { SupportHelpCenter } from '@/components/SupportHelpCenter';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'پشتیبانی و راهنما' },
  { title: 'Help & support' },
);

const MAP_URL =
  'https://www.openstreetmap.org/?mlat=26.5579&mlon=53.9800#map=13/26.5579/53.9800';

export default async function SupportPage() {
  const lang = await getLanguage();
  const t = (fa: string, en: string) => serverT(lang, fa, en);

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <SupportHelpCenter />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
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
                'نمایشگاه‌داران، تامین‌کنندگان قطعات و همکاران تجاری می‌توانند در Ali Sales و پورتال رنت کنار ما باشند.',
                'Showrooms, parts suppliers and commercial partners can join us across Ali Sales and the rental portal.',
              )}
            </p>
            <ul className="mt-3 space-y-1.5 text-[11px] font-bold text-muted">
              <li>• {t('درج بنر و معرفی نمایشگاه', 'Banner placement and showroom feature')}</li>
              <li>• {t('پوشش قطعات و خدمات تخصصی', 'Parts and specialist-service coverage')}</li>
              <li>• {t('همکاری در پورتال رنت خودرو کیش', 'Kish rental portal partnerships')}</li>
            </ul>
            <a href="#ticket" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#111144] px-4 py-2 text-xs font-extrabold text-white transition hover:bg-[#1b1b57]">
              {t('شروع گفتگوی همکاری', 'Start a partnership chat')}
              <Icon name="arrowLeft" size={14} />
            </a>
          </section>
          <div className="rounded-card border border-line bg-card p-4">
            <p className="text-xs font-extrabold text-ink">{t('پاسخ سریع‌تر می‌خواهید؟', 'Want a faster reply?')}</p>
            <p className="mt-1 text-[11px] leading-6 text-muted">
              {t('موضوع درخواست را دقیق انتخاب کنید و کد آگهی را در متن بنویسید؛ همین باعث می‌شود سریع‌تر پیدایش کنیم.', 'Pick the right topic and include the listing code so we can find it faster.')}
            </p>
          </div>
        </aside>
      </div>

      <MyTickets />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: 'phone' as const, label: t('تلفن پشتیبانی', 'Support phone'), value: '0936 000 0000', href: 'tel:+989360000000', ltr: true },
          { icon: 'message' as const, label: t('ایمیل رسمی', 'Official email'), value: 'support@alisales.ir', href: 'mailto:support@alisales.ir', ltr: true },
          { icon: 'pin' as const, label: t('تعمیرگاه شمس‌اله', 'Shamsollah Workshop'), value: t('کیش، جزیره کیش', 'Kish Island'), href: MAP_URL, ltr: false },
        ].map((tile) => (
          <a
            key={tile.label}
            href={tile.href}
            target={tile.href.startsWith('http') ? '_blank' : undefined}
            rel={tile.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="rounded-card border border-line bg-card p-4 transition hover:border-line-strong hover:shadow-sm"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cta-soft text-cta"><Icon name={tile.icon} size={17} /></span>
            <p className="mt-2 text-[10px] font-bold text-muted">{tile.label}</p>
            <p className="mt-1 break-words text-sm font-extrabold text-ink" dir={tile.ltr ? 'ltr' : undefined}>{tile.value}</p>
          </a>
        ))}
      </section>

      <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="group relative flex h-32 items-end overflow-hidden rounded-card border border-line bg-[#dff3ea] p-4 dark:bg-[#132e2b]">
        <span className="absolute inset-0 opacity-70 [background-image:linear-gradient(30deg,transparent_46%,rgba(255,255,255,.75)_47%,rgba(255,255,255,.75)_49%,transparent_50%)] [background-size:80px_80px]" />
        <span className="absolute start-1/3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-[#F98513] text-white shadow-lg"><Icon name="pin" size={19} /></span>
        <span className="relative ms-auto rounded-full bg-[#111144]/85 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">
          {t('نمایش تعمیرگاه روی نقشه کیش', 'Open workshop map')}
        </span>
      </a>
    </article>
  );
}
