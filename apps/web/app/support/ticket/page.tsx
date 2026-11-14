import { localizedMetadata } from '@/lib/i18n/metadata';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SupportForm, type SupportTopic } from '@/components/SupportForm';
import { getLanguage } from '@/lib/i18n/server';
import { serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'ثبت تیکت' },
  { title: 'Submit a ticket' },
);

const TOPICS: readonly SupportTopic[] = ['technical', 'advertising', 'suggestion', 'report'];

function parseTopic(value: string | string[] | undefined): SupportTopic | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return TOPICS.find((topic) => topic === raw);
}

export default async function SupportTicketPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
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
          {t('پشتیبانی و ثبت تیکت', 'Support & tickets')}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t(
            'مشکل یا سؤال خود را بنویسید؛ درخواست شما با شماره پیگیری ثبت می‌شود.',
            'Describe your issue or question; your request will be saved with a reference number.',
          )}
        </p>
      </div>
      <SupportForm kind="ticket" initialTopic={parseTopic(params.topic)} />
    </article>
  );
}
