'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { CarLoader } from './CarLoader';
import { Icon } from './Icon';

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
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (window.location.hash === '#my-tickets') setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    const refresh = () => void load();
    window.addEventListener('alisales:ticket-created', refresh);
    return () => window.removeEventListener('alisales:ticket-created', refresh);
  }, [load, open]);

  return (
    <section id="my-tickets" className="scroll-mt-24 rounded-card border border-line bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="my-tickets-content"
        className="flex w-full items-center gap-3 rounded-card p-4 text-start transition hover:bg-page/60 sm:p-5"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta-soft text-cta">
          <Icon name="message" size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-ink">
            {t('مشاهده تیکت‌های من و پاسخ پشتیبانی', 'View my tickets and support replies')}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted">
            {t('فقط کدهای ذخیره‌شده در همین مرورگر', 'Only codes saved in this browser')}
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-faint transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div id="my-tickets-content" className="overflow-hidden">
          <div className="border-t border-line px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            {loading ? (
              <div className="flex justify-center py-5"><CarLoader size="sm" /></div>
            ) : tickets.length === 0 ? (
              <p className="rounded-field border border-dashed border-line px-4 py-8 text-center text-xs leading-6 text-muted">
                {t('هنوز تیکتی ثبت نکرده‌اید. اولین پیامتان را از فرم بالا بفرستید.', 'No tickets yet. Send your first one from the form above.')}
              </p>
            ) : (
              <ul className="space-y-2.5">
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
          </div>
        </div>
      </div>
    </section>
  );
}
