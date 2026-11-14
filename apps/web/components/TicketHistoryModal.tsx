'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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

const TOPIC_LABELS: Record<string, { fa: string; en: string }> = {
  technical: { fa: 'پشتیبانی فنی', en: 'Technical support' },
  advertising: { fa: 'همکاری و تبلیغات', en: 'Partnership & advertising' },
  suggestion: { fa: 'پیشنهاد برند یا قابلیت', en: 'Brand or feature suggestion' },
  report: { fa: 'گزارش آگهی', en: 'Listing report' },
};

function readCodes(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * The support page's ticket history.
 *
 * The blue trigger sits in the ticket-card header; the history itself opens in
 * a centered dialog so the form and the practical guides stay in place behind
 * it. Only tracking codes saved in this browser can be looked up.
 */
export function TicketHistoryModal() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

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
          const res = await fetch(`/api/support?code=${encodeURIComponent(code)}`, {
            cache: 'no-store',
          });
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
    if (!open) return;
    void load();
    const refresh = () => void load();
    window.addEventListener('alisales:ticket-created', refresh);
    return () => window.removeEventListener('alisales:ticket-created', refresh);
  }, [load, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="bg-[#0F7FC4] hover:bg-[#0d6ead] text-white font-bold rounded-xl px-3.5 py-2 text-xs sm:text-sm shadow-xs"
    >
      {t('مشاهده تیکت‌ها و پاسخ پشتیبانی', 'View my tickets & support replies')}
    </button>
  );

  if (!open || !mounted) return trigger;

  const dialog = (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-[#111144]/55 p-3 backdrop-blur-[2px] sm:p-5"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-history-title"
        className="flex max-h-[min(84dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-[#F4F1EC] shadow-2xl dark:bg-[#0B0D1E]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-[#111144] px-4 py-3 text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
            <Icon name="message" size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="ticket-history-title" className="text-sm font-extrabold">
              {t('تیکت‌های من و پاسخ پشتیبانی', 'My tickets & support replies')}
            </h2>
            <p className="mt-0.5 text-[10px] text-white/60">
              {t('کدهای پیگیری ذخیره‌شده در همین مرورگر', 'Tracking codes saved in this browser')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t('بستن تیکت‌ها', 'Close tickets')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <CarLoader size="sm" label={t('در حال بارگذاری تیکت‌ها', 'Loading tickets')} />
            </div>
          ) : tickets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line bg-card px-4 py-9 text-center text-xs leading-6 text-muted">
              {t(
                'هنوز تیکتی ثبت نکرده‌اید. اولین پیامتان را از فرم همین صفحه بفرستید.',
                'No tickets yet. Send your first message from the form on this page.',
              )}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {tickets.map((ticket) => {
                const answered = ticket.status === 'answered';
                const topic = TOPIC_LABELS[ticket.topic];
                return (
                  <li key={ticket.code} className="rounded-xl border border-line bg-card p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-faint" dir="ltr">
                        {ticket.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          answered
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        }`}
                      >
                        {answered ? t('پاسخ داده شد', 'Answered') : t('در حال بررسی', 'Under review')}
                      </span>
                      <span className="text-[10px] font-bold text-muted">
                        {topic ? (lang === 'en' ? topic.en : topic.fa) : ticket.topic}
                      </span>
                      <time className="ms-auto text-[10px] text-faint">
                        {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
                          dateStyle: 'medium',
                        }).format(new Date(ticket.createdAt))}
                      </time>
                    </div>
                    <p className="mt-2 rounded-lg bg-page px-3 py-2 text-xs leading-6 text-ink/80">
                      {ticket.message}
                    </p>
                    {ticket.reply && (
                      <p className="mt-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs leading-6 text-ink/85">
                        <b className="text-emerald-700 dark:text-emerald-300">
                          {t('پاسخ پشتیبانی: ', 'Support reply: ')}
                        </b>
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
  );

  return (
    <>
      {trigger}
      {createPortal(dialog, document.body)}
    </>
  );
}
