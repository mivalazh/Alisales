'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';
import { SupportForm, type SupportTopic } from './SupportForm';

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

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#111144]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-page p-4 shadow-2xl sm:rounded-2xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted transition hover:text-ink"
          >
            <Icon name="close" size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Support ticket list card — the reference layout is a compact table card with
 * a search/filter row and an explicit «افزودن تیکت جدید» action. Creation opens
 * in a slide-down dialog so the list stays the page's primary surface.
 */
export function SupportTicketCenter() {
  const { t, lang } = useI18n();
  const [mounted, setMounted] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [createTopic, setCreateTopic] = useState<SupportTopic>('technical');
  const [active, setActive] = useState<Ticket | null>(null);

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
          const response = await fetch(`/api/support?code=${encodeURIComponent(code)}`, {
            cache: 'no-store',
          });
          if (!response.ok) return null;
          const body = (await response.json()) as { ticket?: Ticket };
          return body.ticket ?? null;
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

  useEffect(() => {
    if (!createOpen && !active) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setCreateOpen(false);
      setActive(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
  }, [createOpen, active]);

  const topicLabel = useCallback(
    (ticket: Ticket) => {
      const label = TOPIC_LABELS[ticket.topic];
      if (!label) return ticket.topic;
      return lang === 'en' ? label.en : label.fa;
    },
    [lang],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (!q) return true;
      return [ticket.code, topicLabel(ticket), ticket.message]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [query, statusFilter, tickets, topicLabel]);

  const openCreate = (topic: SupportTopic) => {
    setCreateTopic(topic);
    setCreateOpen(true);
  };

  const filterLabel =
    statusFilter === 'all'
      ? t('همه وضعیت‌ها', 'All statuses')
      : statusFilter === 'pending'
        ? t('در حال بررسی', 'Under review')
        : t('پاسخ داده شد', 'Answered');

  return (
    <section
      id="ticket"
      className="scroll-mt-24 space-y-4 rounded-2xl border border-line bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-ink sm:text-xl">
            {t('لیست تیکت‌ها', 'Ticket list')}
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-6 text-muted">
            {t(
              'لیست تیکت‌های خود را از این بخش می‌توانید مورد بررسی قرار دهید.',
              'You can review your support tickets in this section.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate('advertising')}
          className="rounded-full bg-[#F98513] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#e0760c]"
        >
          {t('همکاری با ما', 'Partner with us')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => openCreate('technical')}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F7FC4] px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#0d6ead]"
      >
        <Icon name="plus" size={17} />
        {t('افزودن تیکت جدید', 'Add a new ticket')}
      </button>

      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('جستجو در تیکت‌ها', 'Search tickets')}</span>
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-faint"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('جستجو در تیکت‌ها...', 'Search tickets...')}
            className="field h-11 w-full pe-10"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            setStatusFilter((current) =>
              current === 'all' ? 'pending' : current === 'pending' ? 'answered' : 'all',
            )
          }
          aria-label={`${t('فیلتر وضعیت', 'Filter status')}: ${filterLabel}`}
          title={filterLabel}
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
            statusFilter === 'all'
              ? 'border-line bg-card text-muted hover:text-ink'
              : 'border-[#F98513]/50 bg-[#F98513]/10 text-[#F98513]'
          }`}
        >
          <Icon name="sliders" size={18} />
          {statusFilter !== 'all' && (
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-[#F98513]" />
          )}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-[#F4F1EC] px-4 py-3 text-xs font-bold text-muted dark:bg-white/5">
        <span>{t('عنوان', 'Title')}</span>
        <span>{t('وضعیت', 'Status')}</span>
      </div>

      {loading ? (
        <div className="space-y-2" aria-label={t('در حال بارگذاری تیکت‌ها', 'Loading tickets')}>
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-xl bg-page" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center px-4 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-page text-muted ring-1 ring-line">
            <Icon name="badgeCheck" size={25} />
          </span>
          <p className="mt-3 text-xs font-bold text-muted">
            {t('اطلاعاتی جهت نمایش یافت نشد.', 'No information to display.')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {filtered.map((ticket) => {
            const answered = ticket.status === 'answered';
            return (
              <li key={ticket.code}>
                <button
                  type="button"
                  onClick={() => setActive(ticket)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-start transition hover:bg-page"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-ink">
                      {topicLabel(ticket)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted">
                      {ticket.message}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                      answered
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {answered ? t('پاسخ داده شد', 'Answered') : t('در حال بررسی', 'Under review')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {mounted && createOpen && (
        <ModalShell
          title={t('افزودن تیکت جدید', 'Add a new ticket')}
          subtitle={t(
            'موضوع، مشخصات تماس و متن پیام را کامل کنید.',
            'Complete the topic, contact details and message.',
          )}
          onClose={() => setCreateOpen(false)}
        >
          <SupportForm
            kind="ticket"
            initialTopic={createTopic}
            showHistory={false}
          />
        </ModalShell>
      )}

      {mounted && active && (
        <ModalShell
          title={topicLabel(active)}
          subtitle={active.code}
          onClose={() => setActive(null)}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-page px-2.5 py-1 font-mono text-[10px] font-bold text-muted" dir="ltr">
                {active.code}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                  active.status === 'answered'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}
              >
                {active.status === 'answered'
                  ? t('پاسخ داده شد', 'Answered')
                  : t('در حال بررسی', 'Under review')}
              </span>
              <time className="ms-auto text-[10px] text-faint">
                {new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fa-IR', {
                  dateStyle: 'medium',
                }).format(new Date(active.createdAt))}
              </time>
            </div>
            <p className="rounded-xl bg-card px-4 py-3 text-sm leading-7 text-ink/85">
              {active.message}
            </p>
            {active.reply && (
              <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm leading-7 text-ink/85">
                <b className="text-emerald-700 dark:text-emerald-300">
                  {t('پاسخ پشتیبانی: ', 'Support reply: ')}
                </b>
                {active.reply}
              </p>
            )}
          </div>
        </ModalShell>
      )}
    </section>
  );
}
