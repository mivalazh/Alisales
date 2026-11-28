'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icon';
import { TicketThread } from './support/TicketThread';
import { relativeAge, statusLabel, STATUS_PILL } from './support/status';
import type { ThreadMessage, TicketStatus } from './support/types';
import type { AdminSupportItem } from '@/lib/data/admin-center';
import { useI18n } from '@/lib/i18n';

interface Override {
  status: TicketStatus;
  messages: ThreadMessage[];
}

/**
 * Support inbox inside `/admin`.
 *
 * It reads exactly the thread the seller sees (`data.tickets[].messages`) and
 * answers into the same table, so there is one conversation, not two. A reply
 * sets the ticket to «پاسخ داده شد»; «بسته شدن» closes it for both sides.
 */
export function AdminSupportPanel({ tickets }: { tickets: AdminSupportItem[] }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(tickets[0]?.id ?? null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = tickets.find((ticket) => ticket.id === activeId) ?? null;
  const messages = active
    ? (overrides[active.id]?.messages ?? active.messages)
    : [];
  const status = active
    ? (overrides[active.id]?.status ?? active.status)
    : ('open' as TicketStatus);

  async function act(action: string, payload: Record<string, unknown>): Promise<boolean> {
    if (!active || busy) return false;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, id: active.id, ...payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? t('عملیات انجام نشد.', 'The action failed.'));
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function reply(body: string): Promise<boolean> {
    if (!active) return false;
    const ok = await act('support-reply', { message: body });
    if (!ok) return false;
    const optimistic: ThreadMessage = {
      id: `local-${Date.now()}`,
      senderRole: 'admin',
      senderId: 'support',
      body,
      attachmentUrl: null,
      createdAt: new Date().toISOString(),
    };
    setOverrides((current) => ({
      ...current,
      [active.id]: { status: 'answered', messages: [...messages, optimistic] },
    }));
    return true;
  }

  async function closeTicket(): Promise<void> {
    if (!active) return;
    const ok = await act('support-close', {});
    if (!ok) return;
    setOverrides((current) => ({
      ...current,
      [active.id]: { status: 'closed', messages },
    }));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold">
          {t('تیکت‌های پشتیبانی', 'Support tickets')} ({tickets.length})
        </h2>
        {active && (
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${STATUS_PILL[status]}`}
          >
            {statusLabel(status, lang)}
          </span>
        )}
      </div>

      {tickets.length === 0 ? (
        <p className="mt-2 rounded-card border border-dashed border-line bg-page p-4 text-sm text-muted">
          {t(
            'تیکتی از کاربران ثبت نشده است. فرم پشتیبانی در /support است.',
            'No support tickets yet. The form lives on /support.',
          )}
        </p>
      ) : (
        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-card border border-line bg-card lg:max-h-[560px]">
            {tickets.map((ticket) => {
              const currentStatus = overrides[ticket.id]?.status ?? ticket.status;
              const lastMessage =
                overrides[ticket.id]?.messages ??
                ticket.messages;
              return (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(ticket.id)}
                    aria-current={ticket.id === activeId ? 'true' : undefined}
                    className={`flex w-full flex-col gap-1 px-3 py-2.5 text-start transition ${
                      ticket.id === activeId
                        ? 'bg-[#111144]/[0.05] dark:bg-white/[0.06]'
                        : 'hover:bg-page'
                    }`}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-extrabold text-ink">
                        {ticket.subject || ticket.message.slice(0, 60)}
                      </span>
                      <span className="shrink-0 text-[10px] tabular-nums text-faint">
                        {relativeAge(ticket.updatedAt, lang)}
                      </span>
                    </span>
                    <span className="line-clamp-1 w-full text-[11px] text-muted">
                      {lastMessage[lastMessage.length - 1]?.body ?? ticket.message}
                    </span>
                    <span className="mt-0.5 flex w-full items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${STATUS_PILL[currentStatus]}`}
                      >
                        {statusLabel(currentStatus, lang)}
                      </span>
                      <bdi dir="ltr" className="font-mono text-[10px] font-bold text-faint">
                        {ticket.code}
                      </bdi>
                      <bdi dir="ltr" className="ms-auto text-[10px] font-bold text-faint">
                        {ticket.contact}
                      </bdi>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex h-[520px] min-h-0 flex-col overflow-hidden rounded-card border border-line bg-card">
            {active ? (
              <TicketThread
                subject={active.subject || active.message.slice(0, 60)}
                code={active.code}
                status={status}
                messages={messages}
                role="admin"
                onSend={status === 'closed' ? undefined : reply}
                composerNote={
                  status === 'closed'
                    ? t('این تیکت بسته شده است.', 'This ticket is closed.')
                    : undefined
                }
                headerAction={
                  status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => void closeTicket()}
                      disabled={busy}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line px-2.5 text-[10px] font-extrabold text-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
                    >
                      <Icon name="close" size={12} />
                      {t('بستن تیکت', 'Close')}
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <p className="flex h-full items-center justify-center px-4 text-center text-xs text-muted">
                {t('یک تیکت را انتخاب کنید.', 'Choose a ticket.')}
              </p>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="error-text mt-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
