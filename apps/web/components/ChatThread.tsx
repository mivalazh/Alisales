'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { formatJalaliDate, postingAgeLabel } from '@alisales/schemas';
import { useI18n } from '@/lib/i18n';
import { postingAgeEnglish } from '@/lib/i18n/dictionary';
import { Icon } from './Icon';
import { PriceText } from './PriceText';
import { isPreSizedSource } from '@/lib/images';

export interface ThreadMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  kind?: string;
  visit?: unknown;
}

export interface ChatPeer {
  name: string;
  initials: string;
  /** ISO of the last activity we know about (message or read receipt). */
  lastActiveAt: string | null;
}

export interface ChatListingContext {
  slug: string;
  title: string;
  priceIRR: number;
  coverUrl: string | null;
  sold: boolean;
}

/** Quick replies for the questions buyers actually open a chat with. */
const QUICK_REPLIES = [
  { fa: 'قیمت قابل مذاکره است؟', en: 'Is the price negotiable?' },
  { fa: 'هنوز موجود است؟', en: 'Is it still available?' },
  { fa: 'امکان بازدید هست؟', en: 'Can I see it in person?' },
] as const;

const POLL_MS = 6_000;
const TYPING_THROTTLE_MS = 2_500;
/** Distance from the bottom that still counts as «at the newest message». */
const STICK_THRESHOLD = 48;

function clock(iso: string, lang: 'fa' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(lang === 'en' ? 'en-US' : 'fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function dayLabel(iso: string, lang: 'fa' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return lang === 'en'
    ? date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : formatJalaliDate(date);
}

function relativeSeen(iso: string | null, lang: 'fa' | 'en'): string {
  if (!iso) return lang === 'en' ? 'Last seen unavailable' : 'آخرین بازدید نامشخص';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 2) return lang === 'en' ? 'Online' : 'آنلاین';
  if (lang === 'en') {
    if (minutes < 60) return `Last seen ${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Last seen ${hours} hr ago`;
    return `Last seen ${postingAgeEnglish(iso).toLowerCase()}`;
  }
  return `آخرین بازدید ${postingAgeLabel(iso)}`;
}

/**
 * Messaging thread — the messenger UX, not a form with a list.
 *
 * Sticky header (back, avatar, name, online/last-seen) → pinned listing card →
 * date-separated, sender-grouped bubbles with timestamps and read ticks →
 * typing indicator → sticky composer with quick replies and safe-area padding.
 *
 * Direction: my own messages sit on the start edge (right in RTL, right in
 * LTR too, like a standard messenger), navy with white text; incoming messages
 * sit on the opposite edge in a white/slate card.
 *
 * New messages and presence come from `GET /api/messages` (polling); sending is
 * the existing `POST /api/messages` so role rules and validation stay
 * server-side.
 */
export function ChatThread({
  conversationId,
  currentUserId,
  peer,
  listing,
  initialMessages,
  initialOtherReadAt,
}: {
  conversationId: string;
  currentUserId: string;
  peer: ChatPeer;
  listing: ChatListingContext | null;
  initialMessages: ThreadMessage[];
  initialOtherReadAt: string | null;
}) {
  const { t, lang } = useI18n();
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(initialOtherReadAt);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);
  const textRef = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const scrollToBottom = useCallback((smooth = false) => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    setAtBottom(true);
    setUnread(0);
  }, []);

  useEffect(() => {
    scrollToBottom();
    // First paint only: open on the newest message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const node = listRef.current;
    if (!node) return;
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_THRESHOLD;
    setAtBottom(near);
    if (near) setUnread(0);
  };

  // Poll for new messages + presence while the thread is open.
  useEffect(() => {
    let cancelled = false;

    async function poll(): Promise<void> {
      const last = messages[messages.length - 1];
      const params = new URLSearchParams({ conversationId });
      if (last) params.set('after', last.createdAt);
      try {
        const res = await fetch(`/api/messages?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          messages?: ThreadMessage[];
          typing?: boolean;
          otherReadAt?: string | null;
        };
        if (cancelled) return;
        setPeerTyping(Boolean(data.typing));
        if (data.otherReadAt) setOtherReadAt(data.otherReadAt);
        if (data.messages && data.messages.length > 0) {
          setMessages((current) => {
            const seen = new Set(current.map((m) => m.id));
            const fresh = data.messages!.filter((m) => !seen.has(m.id));
            if (fresh.length === 0) return current;
            if (!atBottom) setUnread((n) => n + fresh.length);
            return [...current, ...fresh];
          });
        }
      } catch {
        // Offline / reloading — the next tick retries.
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // `messages` changes every send; re-arming the interval is cheap and keeps
    // the `after` cursor current.
  }, [conversationId, messages, atBottom]);

  // Keep the newest message in view unless the reader scrolled up on purpose.
  useEffect(() => {
    if (atBottom) scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  /** Debounced «I am typing» beacon (throttled, never one request per key). */
  function announceTyping(value: string): void {
    setText(value);
    if (value.trim().length === 0) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    void fetch('/api/messages/typing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, typing: true }),
    }).catch(() => undefined);
  }

  async function send(bodyOverride?: string): Promise<void> {
    const body = (bodyOverride ?? text).trim();
    if (!body || busy) return;
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ThreadMessage = {
      id: optimisticId,
      senderId: currentUserId,
      body,
      createdAt: new Date().toISOString(),
    };

    // The bubble appears immediately; the server message replaces it in place.
    setMessages((current) => [...current, optimistic]);
    if (!bodyOverride) setText('');
    setBusy(true);
    setError(null);
    scrollToBottom(true);

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: ThreadMessage;
        error?: string;
      };
      if (res.ok && data.message) {
        const confirmed = data.message;
        setMessages((current) => [
          ...current.filter((m) => m.id !== optimisticId && m.id !== confirmed.id),
          confirmed,
        ]);
        scrollToBottom(true);
        return;
      }
      setMessages((current) => current.filter((m) => m.id !== optimisticId));
      if (!bodyOverride) setText(body);
      setError(data.error ?? t('ارسال پیام ناموفق بود.', 'Could not send the message.'));
    } catch {
      setMessages((current) => current.filter((m) => m.id !== optimisticId));
      if (!bodyOverride) setText(body);
      setError(t('ارتباط با سرور برقرار نشد.', 'Could not reach the server.'));
    } finally {
      setBusy(false);
    }
  }

  /** Enter sends, Shift+Enter starts a new line. */
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  // Group + date-separate once per render rather than per bubble.
  const blocks = useMemo(() => buildBlocks(messages, lang), [messages, lang]);

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-2xl flex-col sm:h-[calc(100dvh-9rem)]">
      {/* Messenger header: back, peer identity, presence. Nothing else. */}
      <header className="sticky top-16 z-30 flex items-center gap-2 border-b border-line bg-card/95 px-2 py-2 backdrop-blur sm:top-20">
        <Link
          href="/chats"
          aria-label={t('بازگشت به چت‌ها', 'Back to chats')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink active:scale-95"
        >
          <Icon name="chevronRight" size={18} />
        </Link>
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cta-soft text-sm font-extrabold text-ink"
        >
          {peer.initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">{peer.name}</p>
          <p className="flex items-center gap-1 text-[11px] font-bold text-muted">
            {peerTyping ? (
              <span className="text-cta">{t('در حال نوشتن…', 'Typing…')}</span>
            ) : (
              <>
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{
                    background:
                      mounted && peer.lastActiveAt && Date.now() - Date.parse(peer.lastActiveAt) < 120_000
                        ? '#22C55E'
                        : '#94A3B8',
                  }}
                />
                {mounted
                  ? relativeSeen(peer.lastActiveAt, lang)
                  : t('آخرین بازدید', 'Last seen')}
              </>
            )}
          </p>
        </div>
      </header>

      {/* Pinned listing: one compact strip, the whole row opens the listing. */}
      {listing && (
        <Link
          href={`/listing/${listing.slug}`}
          aria-label={t('مشاهده آگهی', 'View listing')}
          className="mt-2 flex items-center gap-2.5 rounded-xl border border-line bg-card p-2 transition hover:border-line-strong active:scale-[0.99]"
        >
          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-sunken">
            {listing.coverUrl && (
              <Image
                src={listing.coverUrl}
                alt={listing.title}
                fill
                sizes="64px"
                unoptimized={isPreSizedSource(listing.coverUrl)}
                loading="lazy"
                decoding="async"
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-ink">{listing.title}</p>
            <PriceText irr={listing.priceIRR} sold={listing.sold} />
          </div>
          <Icon name="chevronLeft" size={15} className="shrink-0 text-faint" />
        </Link>
      )}

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label={t('پیام‌ها', 'Messages')}
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1 py-3"
        >
          {messages.length === 0 && (
            <div className="m-auto max-w-xs px-4 text-center">
              <Icon name="message" size={36} className="mx-auto text-faint" />
              <p className="mt-3 text-sm font-extrabold text-ink">
                {t('هنوز پیامی رد و بدل نشده است', 'No messages yet')}
              </p>
              <p className="mt-1 text-xs leading-6 text-muted">
                {t(
                  'با یکی از پاسخ‌های آماده شروع کنید؛ فروشنده سریع‌تر جواب می‌دهد.',
                  'Start with a quick reply; sellers usually answer faster.',
                )}
              </p>
            </div>
          )}

          {blocks.map((block) => (
            <div key={block.key}>
              {mounted && block.dateLabel && (
                <div className="my-2 flex items-center justify-center">
                  <span className="rounded-[var(--radius-pill)] bg-card/90 px-3 py-0.5 text-[10px] font-extrabold text-faint shadow-sm backdrop-blur">
                    {block.dateLabel}
                  </span>
                </div>
              )}

              {block.messages.map((message, index) => {
                const mine = message.senderId === currentUserId;
                const grouped =
                  index > 0 && block.messages[index - 1]!.senderId === message.senderId;
                const last = index === block.messages.length - 1;
                const read = Boolean(otherReadAt && otherReadAt >= message.createdAt);
                return (
                  <div
                    key={message.id}
                    className={`flex ${
                      mine
                        ? lang === 'fa'
                          ? 'justify-start'
                          : 'justify-end'
                        : lang === 'fa'
                          ? 'justify-end'
                          : 'justify-start'
                    } ${grouped ? 'mt-0.5' : 'mt-1.5'}`}
                  >
                    <div
                      dir="auto"
                      className={`max-w-[82%] rounded-2xl px-3 py-2 text-start text-sm leading-6 shadow-sm ${
                        mine
                          ? 'rounded-br-sm bg-[#111144] text-white'
                          : 'rounded-bl-sm border border-line bg-white text-ink dark:bg-[#161A38]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      {last && (
                        <span
                          className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] font-semibold ${
                            mine ? 'text-white/60' : 'text-faint'
                          }`}
                        >
                          <time dateTime={message.createdAt}>
                            {mounted ? clock(message.createdAt, lang) : ''}
                          </time>
                          {mine && (
                            <span
                              aria-label={
                                read
                                  ? t('خوانده شد', 'Read')
                                  : t('ارسال شد', 'Sent')
                              }
                              className="tracking-tighter"
                            >
                              {read ? (
                                <span style={{ color: '#F98513' }}>✓✓</span>
                              ) : (
                                '✓'
                              )}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {peerTyping && (
            <div className="mt-1 flex justify-end">
              <div className="flex items-center gap-1 rounded-2xl rounded-tr-md border border-line bg-card px-3 py-2">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-faint"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* «پیام‌های جدید» pill while scrolled up */}
        {!atBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-[var(--radius-pill)] bg-[#111144] px-3 py-1.5 text-[11px] font-extrabold text-white shadow-lg"
          >
            {unread > 0
              ? t(
                  `${unread} پیام جدید ↓`,
                  `${unread} new ${unread === 1 ? 'message' : 'messages'} ↓`,
                )
              : t('آخرین پیام‌ها ↓', 'Latest messages ↓')}
          </button>
        )}
      </div>

      {/* Quick replies */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {QUICK_REPLIES.map((reply) => {
          const label = t(reply.fa, reply.en);
          return (
            <button
              key={reply.fa}
              type="button"
              onClick={() => void send(label)}
              disabled={busy}
              className="shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-cta hover:text-ink active:scale-95 disabled:opacity-50"
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Composer — one pill anchored above the phone tab bar. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="mt-2 flex items-end gap-2 rounded-full border border-line bg-card p-1.5 shadow-sm"
      >
        <label htmlFor="message" className="sr-only">
          {t('متن پیام', 'Message text')}
        </label>
        <textarea
          id="message"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-full bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => announceTyping(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('پیام خود را بنویسید…', 'Write a message…')}
        />
        <button
          type="submit"
          disabled={busy || text.trim().length === 0}
          aria-label={t('ارسال پیام', 'Send message')}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F98513] text-white transition active:scale-95 disabled:opacity-50"
        >
          <Icon name="send" size={18} />
        </button>
      </form>

      {error && (
        <p className="error-text mt-1 px-2" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface Block {
  key: string;
  dateLabel: string | null;
  messages: ThreadMessage[];
}

/**
 * Splits the thread into date blocks, and each block into runs by sender so
 * consecutive bubbles from one person read as one group.
 */
function buildBlocks(messages: ThreadMessage[], lang: 'fa' | 'en'): Block[] {
  const blocks: Block[] = [];
  let currentDay = '';
  let groupKey = '';

  for (const message of messages) {
    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      currentDay = day;
      groupKey = '';
      blocks.push({
        key: `day-${day}-${message.id}`,
        dateLabel: dayLabel(message.createdAt, lang),
        messages: [message],
      });
      groupKey = `${blocks.length}-${message.senderId}`;
      continue;
    }
    const last = blocks[blocks.length - 1]!;
    const prev = last.messages[last.messages.length - 1];
    const sameSender = prev && prev.senderId === message.senderId;
    const closeInTime =
      prev && Date.parse(message.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
    if (sameSender && closeInTime) {
      last.messages.push(message);
    } else {
      groupKey = `${blocks.length}-${message.senderId}-${message.id}`;
      last.messages.push(message);
    }
    void groupKey;
  }
  return blocks;
}

/** Loading state for the chat route: skeleton header, context card and bubbles. */
export function ChatThreadSkeleton() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] max-w-2xl flex-col sm:h-[calc(100dvh-9rem)]">
      <div className="flex items-center gap-2 border-b border-line bg-card p-2">
        <span className="skeleton h-9 w-9 rounded-full" />
        <span className="skeleton h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <span className="skeleton block h-3 w-28" />
          <span className="skeleton block h-2.5 w-20" />
        </div>
      </div>
      <div className="skeleton mt-2 h-16 rounded-xl" />
      <div className="mt-2 flex flex-1 flex-col gap-2 p-2">
        <span className="skeleton h-8 w-2/3 self-end rounded-2xl" />
        <span className="skeleton h-10 w-1/2 self-start rounded-2xl" />
        <span className="skeleton h-8 w-3/5 self-end rounded-2xl" />
        <span className="skeleton h-12 w-2/3 self-start rounded-2xl" />
      </div>
      <div className="skeleton mt-2 h-12 rounded-full" />
    </div>
  );
}
