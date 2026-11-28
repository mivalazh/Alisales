'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';
import { TicketThread } from './support/TicketThread';
import { NewTicketDialog, type NewTicketTopic } from './support/NewTicketDialog';
import { relativeAge, statusLabel, STATUS_PILL } from './support/status';
import type { ThreadMessage, TicketStatus, TicketSummary } from './support/types';

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

/** Guest tickets tracked by code keep working, without an account. */
async function guestTickets(): Promise<TicketSummary[]> {
  const codes = readCodes();
  if (codes.length === 0) return [];
  const rows = await Promise.all(
    codes.slice(0, 12).map(async (code) => {
      try {
        const response = await fetch(`/api/support?code=${encodeURIComponent(code)}`, {
          cache: 'no-store',
        });
        if (!response.ok) return null;
        const body = (await response.json()) as {
          ticket?: {
            id: string;
            code: string;
            subject?: string;
            topic: string;
            status: TicketStatus;
            message: string;
            createdAt: string;
          };
        };
        const ticket = body.ticket;
        if (!ticket) return null;
        return {
          id: ticket.id ?? ticket.code,
          code: ticket.code,
          subject: ticket.subject || ticket.message.slice(0, 72),
          topic: ticket.topic,
          status: ticket.status,
          preview: ticket.message,
          createdAt: ticket.createdAt,
          updatedAt: ticket.createdAt,
        } satisfies TicketSummary;
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((row): row is TicketSummary => Boolean(row));
}

/**
 * Support inbox — a real helpdesk surface.
 *
 * Desktop: the ticket list sits on the start (right) edge and the conversation
 * fills the rest. Phone: the list is the page, and a ticket opens as a
 * full-screen thread with its own sticky header and composer. Both panes read
 * the same `/api/support` thread, so a reply from support appears without a
 * page load.
 */
export function SupportTicketCenter() {
  const { t, lang } = useI18n();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<TicketSummary | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<TicketStatus>('open');
  const [threadLoading, setThreadLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch('/api/support', { cache: 'no-store' });
      if (!res.ok) throw new Error(`support ${res.status}`);
      const data = (await res.json()) as { authed?: boolean; tickets?: TicketSummary[] };
      setAuthed(Boolean(data.authed));
      const list = Array.isArray(data.tickets) ? data.tickets : [];
      setTickets(data.authed ? list : await guestTickets());
    } catch {
      setFailed(true);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(
    async (ticket: TicketSummary, mobile: boolean) => {
      setSelected(ticket);
      setMobileOpen(mobile);
      setThread([]);
      setThreadStatus(ticket.status);
      setThreadLoading(true);
      const id = ++requestId.current;
      try {
        const query = authed
          ? `ticketId=${encodeURIComponent(ticket.id)}`
          : `code=${encodeURIComponent(ticket.code)}`;
        const res = await fetch(`/api/support?${query}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as {
          ticket?: { status?: TicketStatus };
          messages?: ThreadMessage[];
        };
        if (id !== requestId.current) return;
        setThread(Array.isArray(data.messages) ? data.messages : []);
        if (data.ticket?.status) setThreadStatus(data.ticket.status);
      } catch {
        // The pane keeps its empty state; the list still works.
      } finally {
        if (id === requestId.current) setThreadLoading(false);
      }
    },
    [authed],
  );

  // Desktop lands on the newest conversation instead of an empty pane.
  useEffect(() => {
    if (loading || selected || tickets.length === 0) return;
    void openThread(tickets[0]!, false);
  }, [loading, openThread, selected, tickets]);

  async function send(body: string): Promise<boolean> {
    if (!selected || !authed) return false;
    try {
      const res = await fetch(`/api/support/${selected.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: TicketStatus;
        messages?: ThreadMessage[];
      };
      if (!res.ok) return false;
      const nextStatus = data.status ?? 'pending';
      if (Array.isArray(data.messages)) setThread(data.messages);
      setThreadStatus(nextStatus);
      setTickets((current) =>
        current.map((ticket) =>
          ticket.id === selected.id
            ? { ...ticket, status: nextStatus, preview: body, updatedAt: new Date().toISOString() }
            : ticket,
        ),
      );
      setSelected((current) => (current ? { ...current, status: nextStatus } : current));
      return true;
    } catch {
      return false;
    }
  }

  async function handleCreated(created: { id: string; code: string }) {
    setCreateOpen(false);
    await load();
    const res = await fetch('/api/support', { cache: 'no-store' });
    const data = (await res.json().catch(() => ({}))) as { tickets?: TicketSummary[] };
    const fresh = (data.tickets ?? []).find((ticket) => ticket.id === created.id);
    if (fresh) {
      void openThread(fresh, false);
      return;
    }
    setSelected({
      id: created.id,
      code: created.code,
      subject: t('تیکت جدید', 'New ticket'),
      topic: 'technical',
      status: 'open',
      preview: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const counts = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status !== 'closed').length;
    return { open, total: tickets.length };
  }, [tickets]);

  const emptyState = (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-page text-[#111144] dark:text-[#9BACD8]">
        <Icon name="message" size={22} />
      </span>
      <p className="mt-3 text-sm font-extrabold text-ink">
        {failed
          ? t('تیکت‌ها فعلاً در دسترس نیستند', 'Tickets are temporarily unavailable')
          : t('هنوز تیکتی ثبت نکرده‌اید', 'No tickets yet')}
      </p>
      <p className="mt-1 max-w-xs text-xs leading-6 text-muted">
        {failed
          ? t('اتصال را بررسی کنید و دوباره تلاش کنید.', 'Check your connection and try again.')
          : t(
              'سؤال یا مشکل خود را در یک تیکت بنویسید؛ گفتگو با تیم پشتیبانی همین‌جا ادامه پیدا می‌کند.',
              'Open a ticket with your question; the conversation continues right here.',
            )}
      </p>
      <button
        type="button"
        onClick={() => (failed ? void load() : setCreateOpen(true))}
        className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#111144] px-4 text-sm font-extrabold text-white transition hover:bg-[#1b1b5c] dark:bg-[#F98513] dark:text-[#111144]"
      >
        {!failed && <Icon name="plus" size={16} />}
        {failed ? t('تلاش دوباره', 'Try again') : t('افزودن تیکت جدید', 'Add a new ticket')}
      </button>
    </div>
  );

  const listPane = (
    <div className="flex min-h-0 flex-col border-line lg:border-e">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
        <p className="text-xs font-extrabold text-muted">
          {t('تیکت‌های من', 'My tickets')}
          <span className="ms-1.5 tabular-nums text-faint">{counts.total}</span>
        </p>
        <span className="rounded-full bg-[#F98513]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#B45309] dark:text-[#F98513]">
          {counts.open} {t('باز', 'open')}
        </span>
      </div>

      {loading ? (
        <ul className="space-y-2 p-3" aria-busy="true">
          {[0, 1, 2, 3].map((row) => (
            <li key={row} className="h-16 animate-pulse rounded-xl bg-page" />
          ))}
        </ul>
      ) : tickets.length === 0 ? (
        emptyState
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
          {tickets.map((ticket) => {
            const active = selected?.id === ticket.id;
            const topic = TOPIC_LABELS[ticket.topic];
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() =>
                    void openThread(
                      ticket,
                      typeof window !== 'undefined' &&
                        !window.matchMedia('(min-width: 1024px)').matches,
                    )
                  }
                  aria-current={active ? 'true' : undefined}
                  className={`flex w-full flex-col gap-1 px-3 py-3 text-start transition ${
                    active ? 'bg-[#111144]/[0.05] dark:bg-white/[0.06]' : 'hover:bg-page'
                  }`}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink">
                      {ticket.subject}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-faint">
                      {relativeAge(ticket.updatedAt, lang)}
                    </span>
                  </span>
                  <span className="line-clamp-1 w-full text-[11px] leading-5 text-muted">
                    {ticket.preview}
                  </span>
                  <span className="mt-0.5 flex w-full flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[ticket.status]}`}
                    >
                      {statusLabel(ticket.status, lang)}
                    </span>
                    <span className="text-[10px] font-bold text-faint">
                      {topic ? (lang === 'en' ? topic.en : topic.fa) : ticket.topic}
                    </span>
                    <bdi dir="ltr" className="ms-auto font-mono text-[10px] font-bold text-faint">
                      {ticket.code}
                    </bdi>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  const threadPane = (
    <div className="min-h-0 flex-1 bg-card">
      {selected ? (
        <TicketThread
          subject={selected.subject}
          code={selected.code}
          status={threadStatus}
          messages={threadLoading ? [] : thread}
          role="user"
          onSend={authed ? send : undefined}
          composerNote={
            threadLoading
              ? t('در حال بارگذاری گفتگو…', 'Loading the conversation…')
              : authed
                ? undefined
                : t('برای ادامه گفتگو وارد حساب شوید.', 'Sign in to continue this conversation.')
          }
          emptyLabel={
            threadLoading
              ? t('در حال بارگذاری گفتگو…', 'Loading the conversation…')
              : undefined
          }
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-page text-[#111144] dark:text-[#9BACD8]">
            <Icon name="message" size={20} />
          </span>
          <p className="mt-3 text-sm font-extrabold text-ink">
            {t('یک تیکت را انتخاب کنید', 'Choose a ticket')}
          </p>
          <p className="mt-1 max-w-xs text-xs leading-6 text-muted">
            {t(
              'گفتگوی کامل هر تیکت، به ترتیب زمان، در این ستون نمایش داده می‌شود.',
              'The full conversation of the selected ticket appears here in order.',
            )}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <section
      id="ticket"
      className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
    >
      {/* Header: one clear creation action in brand navy, no second CTA row. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-ink sm:text-xl">
            {t('تیکت‌های پشتیبانی', 'Support tickets')}
          </h1>
          <p className="mt-0.5 text-xs leading-5 text-muted">
            {t(
              'گفتگوی مستقیم با تیم پشتیبانی علی‌سیلز؛ پاسخ‌ها همین‌جا ثبت می‌شوند.',
              'A direct conversation with Ali Sales support — replies stay here.',
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#111144] px-4 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#1b1b5c] dark:bg-[#F98513] dark:text-[#111144] dark:hover:bg-[#e57a10]"
        >
          <Icon name="plus" size={17} />
          {t('افزودن تیکت جدید', 'Add a new ticket')}
        </button>
      </div>

      {/* Desktop: list on the start (right) edge, thread on the other side. */}
      <div className="hidden h-[min(70vh,640px)] min-h-[420px] lg:flex">
        <div className="flex w-[340px] shrink-0 flex-col">{listPane}</div>
        {threadPane}
      </div>

      {/* Phone/tablet: the list is the page. */}
      <div className="lg:hidden">{tickets.length === 0 && !loading ? emptyState : listPane}</div>

      {mobileOpen && selected && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-page lg:hidden">
          <TicketThread
            subject={selected.subject}
            code={selected.code}
            status={threadStatus}
            messages={threadLoading ? [] : thread}
            role="user"
            onSend={authed ? send : undefined}
            onBack={() => setMobileOpen(false)}
            composerNote={
              threadLoading
                ? t('در حال بارگذاری گفتگو…', 'Loading the conversation…')
                : authed
                  ? undefined
                  : t('برای ادامه گفتگو وارد حساب شوید.', 'Sign in to continue this conversation.')
            }
          />
        </div>
      )}

      <NewTicketDialog
        open={createOpen}
        authed={authed === true}
        defaultTopic={'technical' as NewTicketTopic}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => void handleCreated(created)}
      />
    </section>
  );
}
