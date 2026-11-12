'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { CarLoader } from './CarLoader';

interface Ticket {
  code: string;
  topic: string;
  status: 'pending' | 'answered';
  reply: string | null;
  message: string;
  createdAt: string;
}

const CODES_KEY = 'alisales-ticket-codes';

const TOPIC_FA: Record<string, string> = {
  technical: 'پشتیبانی فنی',
  advertising: 'همکاری و تبلیغات',
  suggestion: 'پیشنهاد برند یا قابلیت',
  report: 'گزارش آگهی',
};

function readCodes(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function MyTickets() {
  const { t, lang } = useI18n();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const codes = readCodes();
    if (codes.length === 0) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await Promise.all(
      codes.map(async (code) => {
        try {
          const res = await fetch(`/api/support?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
          if (!res.ok) return null;
          const data = (await res.json()) as { ticket?: Ticket };
          return data.ticket ?? null;
        } catch {
          return null;
        }
      }),
    );
    setTickets(rows.filter((row): row is Ticket => Boolean(row)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('alisales:ticket-created', refresh);
    return () => window.removeEventListener('alisales:ticket-created', refresh);
  }, [load]);

  return (
    <section id="my-tickets" className="scroll-mt-24 rounded-card border border-line bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-ink">{t('تیکت‌های من و پاسخ پشتیبانی', 'My tickets & support replies')}</h2>
          <p className="mt-1 text-xs text-muted">
            {t('بر اساس کدهای پیگیری ذخیره‌شده در همین مرورگر.', 'From tracking codes saved in this browser.')}
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="text-[11px] font-bold text-cta underline">
          {t('بروزرسانی', 'Refresh')}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center py-5"><CarLoader size="sm" /></div>
      ) : tickets.length === 0 ? (
        <p className="mt-4 rounded-field border border-dashed border-line px-4 py-8 text-center text-xs leading-6 text-muted">
          {t('هنوز تیکتی ثبت نکرده‌اید. اولین پیامتان را از فرم بالا بفرستید.', 'No tickets yet. Send your first one from the form above.')}
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {tickets.map((ticket) => {
            const answered = ticket.status === 'answered';
            return (
              <li key={ticket.code} className="rounded-2xl border border-line bg-page/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold text-faint" dir="ltr">{ticket.code}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${answered ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                    {answered ? t('پاسخ داده شد', 'Answered') : t('در حال بررسی', 'Under review')}
                  </span>
                  <span className="text-[10px] font-bold text-muted">
                    {TOPIC_FA[ticket.topic] ?? ticket.topic}
                  </span>
                  <time className="ms-auto text-[10px] text-faint">
                    {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', { dateStyle: 'medium' }).format(new Date(ticket.createdAt))}
                  </time>
                </div>
                <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs leading-6 text-ink/75">{ticket.message}</p>
                {ticket.reply && (
                  <p className="mt-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs leading-6 text-ink/85">
                    <b className="text-emerald-700 dark:text-emerald-300">{t('پاسخ پشتیبانی: ', 'Support reply: ')}</b>
                    {ticket.reply}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
