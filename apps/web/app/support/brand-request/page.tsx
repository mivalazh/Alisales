import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SupportForm } from '@/components/SupportForm';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'پیشنهادات شما برای بهتر کردن سایت' },
  { title: 'Your suggestions to improve the site' },
);

export default async function BrandRequestPage() {
  const lang = await getLanguage();
  const t = (fa: string, en?: string) => serverT(lang, fa, en);
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <Link
        href="/support"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted transition hover:text-ink"
      >
        <Icon name="arrowLeft" size={18} />
        {t('بازگشت به پشتیبانی', 'Back to support')}
      </Link>
      <div>
        <h1 className="text-xl font-extrabold">
          {t('پیشنهادات شما برای بهتر کردن سایت', 'Suggestions to improve the site')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            'خودرو، برند، قطعه یا هر تغییری که دوست دارید در آلی‌سیلز ببینید را بنویسید؛ پیشنهادها در نوبت بررسی تیم محصول قرار می‌گیرد.',
            'Tell us about a vehicle, brand, part or any change you would like to see on Ali Sales; suggestions are reviewed by our product team.',
          )}
        </p>
      </div>
      <SupportForm kind="brand" />
    </article>
  );
}
