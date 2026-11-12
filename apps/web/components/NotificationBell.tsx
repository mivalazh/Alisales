'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon, type IconName } from './Icon';
import {
  LOCAL_NOTIFICATIONS_EVENT,
  readLocalNotifications,
  type LocalNotification,
} from '@/lib/local-notifications';

interface ServerNotification {
  id: string;
  kind: 'saved_sold' | 'followed' | 'inspection';
  title: string;
  body: string;
  href: string;
  createdAt: string;
}

type Item = (ServerNotification | LocalNotification) & {
  kind: ServerNotification['kind'] | LocalNotification['kind'] | 'saved';
};

const READ_KEY = 'alisales-notifications-read-at';

const ICON_FOR: Record<string, IconName> = {
  saved: 'bookmark',
  saved_sold: 'bookmarkFilled',
  followed: 'sparkle',
  inspection: 'shieldCheck',
  ticket_reply: 'message',
};

function relative(iso: string, lang: 'fa' | 'en'): string {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return '';
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return lang === 'en' ? 'just now' : 'همین حالا';
  if (minutes < 60) return lang === 'en' ? `${minutes}m ago` : `${minutes} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return lang === 'en' ? `${hours}h ago` : `${hours} ساعت پیش`;
  const days = Math.round(hours / 24);
  return lang === 'en' ? `${days}d ago` : `${days} روز پیش`;
}

export function NotificationBell({ authed }: { authed: boolean }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [serverItems, setServerItems] = useState<ServerNotification[]>([]);
  const [localItems, setLocalItems] = useState<LocalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readAt, setReadAt] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setReadAt(window.localStorage.getItem(READ_KEY));
    } catch {
      // private mode
    }
    const syncLocal = () => setLocalItems(readLocalNotifications());
    syncLocal();
    window.addEventListener(LOCAL_NOTIFICATIONS_EVENT, syncLocal);
    return () => window.removeEventListener(LOCAL_NOTIFICATIONS_EVENT, syncLocal);
  }, []);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setLoading(true);
    fetch('/api/notifications', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: ServerNotification[] } | null) => {
        if (!cancelled && Array.isArray(data?.items)) setServerItems(data.items);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [...localItems, ...serverItems]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12) as Item[];
  const unread = items.filter((item) => !readAt || item.createdAt > readAt).length;

  function markAllRead(): void {
    const now = new Date().toISOString();
    setReadAt(now);
    try {
      window.localStorage.setItem(READ_KEY, now);
    } catch {
      // session-only clear
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('اعلان‌ها', 'Notifications')}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:border-line-strong"
      >
        <Icon name="bell" size={20} />
        {unread > 0 && (
          <span className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F98513] px-1 text-[9px] font-black text-[#111144] ring-2 ring-card">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t('اعلان‌ها', 'Notifications')}
          className="fixed left-3 right-3 top-[4.5rem] z-50 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <p className="text-sm font-extrabold text-ink">{t('اعلان‌ها', 'Notifications')}</p>
            {items.length > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] font-bold text-cta underline">
                {t('خواندن همه', 'Mark all as read')}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="space-y-2 p-3" aria-busy="true">
                <span className="skeleton block h-12 rounded-xl" />
                <span className="skeleton block h-12 rounded-xl" />
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-cta-soft text-cta">
                  <Icon name="bell" size={20} />
                </span>
                <p className="mt-2 text-sm font-extrabold text-ink">{t('اعلان تازه‌ای ندارید', 'You are all caught up')}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted">
                  {t('با ذخیره یک آگهی یا ثبت تیکت، اعلانش همین‌جا ظاهر می‌شود.', 'Save a listing or send a ticket and its update appears here.')}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((item) => {
                  const unreadItem = !readAt || item.createdAt > readAt;
                  return (
                    <li key={item.id}>
                      <Link href={item.href} onClick={() => setOpen(false)} className="flex gap-2.5 px-3 py-2.5 transition hover:bg-cta-soft">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F98513]/15 text-[#F98513]">
                          <Icon name={ICON_FOR[item.kind] ?? 'bell'} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-1.5">
                            <span className="min-w-0 flex-1 text-xs font-extrabold text-ink">{item.title}</span>
                            {unreadItem && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F98513]" />}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{item.body}</span>
                          <span className="mt-1 block text-[10px] font-bold text-faint">{relative(item.createdAt, lang)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
