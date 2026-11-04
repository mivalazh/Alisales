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
  'قیمت قابل مذاکره است؟',
  'هنوز موجود است؟',
  'امکان بازدید هست؟',
] as const;

const POLL_MS = 6_000;
const TYPING_THROTTLE_MS = 2_500;
/** Distance from the bottom that still counts as «at the newest message». */
const STICK_THRESHOLD = 48;

function clock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

function dayKey(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatJalaliDate(date);
}

function relativeSeen(iso: string | null): string {
  if (!iso) return 'آخرین بازدید نامشخص';
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (minutes < 2) return 'آنلاین';
  return `آخرین بازدید ${postingAgeLabel(iso)}`;
}

/**
 * Messaging thread — the messenger UX, not a form with a list.
 *
 * Sticky header (back, avatar, name, online/last-seen) → pinned listing card →
 * date-separated, sender-grouped bubbles with timestamps and read ticks →
 * typing indicator → sticky composer with quick replies and safe-area padding.
 *
 * Direction: like Telegram/WhatsApp in RTL, my own messages sit on the left
 * edge and the other party's on the right, each with its own bubble tail.
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
    setBusy(true);
    setError(null);
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
        setMessages((current) =>
          current.some((m) => m.id === data.message!.id)
            ? current
            : [...current, data.message as ThreadMessage],
        );
        if (!bodyOverride) setText('');
        scrollToBottom(true);
        return;
      }
      setError(data.error ?? 'ارسال پیام ناموفق بود.');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
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
  const blocks = useMemo(() => buildBlocks(messages, currentUserId), [messages, currentUserId]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {/* Sticky header */}
      <header className="sticky top-16 z-30 flex items-center gap-2 rounded-card border border-line bg-card/95 px-2 py-2 backdrop-blur sm:top-20">
        <Link
          href="/chats"
          aria-label="بازگشت به چت‌ها"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-cta-soft hover:text-ink"
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
              <span className="text-cta">در حال نوشتن…</span>
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
                {mounted ? relativeSeen(peer.lastActiveAt) : 'آخرین بازدید'}
              </>
            )}
          </p>
        </div>
        {listing && (
          <Link
            href={`/listing/${listing.slug}`}
            className="hidden shrink-0 rounded-[var(--radius-pill)] border border-line px-3 py-1.5 text-[11px] font-extrabold text-muted transition hover:border-line-strong hover:text-ink sm:block"
          >
            مشاهده آگهی
          </Link>
        )}
      </header>

      {/* Pinned listing context */}
      {listing && (
        <div className="mt-2 flex items-center gap-2 rounded-card border border-line bg-cta-soft/40 p-2">
          <div className="relative h-12 w-16 shrink-0 overflow-hidden rounded-field bg-sunken">
            {listing.coverUrl && (
              <Image
                src={listing.coverUrl}
                alt={listing.title}
                fill
                sizes="64px"
                unoptimized={isPreSizedSource(listing.coverUrl)}
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-ink">{listing.title}</p>
            <PriceText irr={listing.priceIRR} sold={listing.sold} />
          </div>
          <Link
            href={`/listing/${listing.slug}`}
            className="shrink-0 text-[11px] font-extrabold text-cta underline"
          >
            مشاهده آگهی
          </Link>
        </div>
      )}

      {/* Messages */}
      <div className="relative mt-2">
        <div
          ref={listRef}
          onScroll={onScroll}
          role="log"
          aria-label="پیام‌ها"
          aria-live="polite"
          className="flex h-[58vh] min-h-[280px] flex-col gap-1 overflow-y-auto rounded-card border border-line bg-page px-2 py-3"
        >
          {messages.length === 0 && (
            <div className="m-auto max-w-xs text-center">
              <Icon name="message" size={36} className="mx-auto text-faint" />
              <p className="mt-3 text-sm font-extrabold text-ink">هنوز پیامی رد و بدل نشده است</p>
              <p className="mt-1 text-xs text-muted">
                با یکی از پاسخ‌های آماده شروع کنید؛ فروشنده سریع‌تر جواب می‌دهد.
              </p>
            </div>
          )}

          {blocks.map((block) => (
            <div key={block.key}>
              {mounted && block.dateLabel && (
                <div className="my-2 flex items-center justify-center">
                  <span className="rounded-[var(--radius-pill)] bg-card px-3 py-0.5 text-[10px] font-extrabold text-faint shadow-sm">
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
                    className={`flex ${mine ? 'justify-end' : 'justify-start'} ${
                      grouped ? 'mt-0.5' : 'mt-1.5'
                    }`}
                  >
                    <div
                      dir="rtl"
                      className={`max-w-[82%] px-3 py-1.5 text-sm leading-6 shadow-sm ${
                        mine
                          ? 'bg-cta-soft text-ink'
                          : 'border border-line bg-card text-ink'
                      } ${
                        mine
                          ? grouped
                            ? 'rounded-2xl rounded-tl-md'
                            : 'rounded-2xl rounded-tl-md rounded-bl-md'
                          : grouped
                            ? 'rounded-2xl rounded-tr-md'
                            : 'rounded-2xl rounded-tr-md rounded-br-md'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      {last && (
                        <span className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-faint">
                          <time dateTime={message.createdAt}>{mounted ? clock(message.createdAt) : ''}</time>
                          {mine && (
                            <span aria-label={read ? 'خوانده شد' : 'ارسال شد'} className="tracking-tighter">
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
            <div className="mt-1 flex justify-start">
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
            className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-[var(--radius-pill)] bg-ink px-3 py-1.5 text-[11px] font-extrabold text-page shadow-lg"
          >
            {unread > 0 ? `${unread} پیام جدید ↓` : 'آخرین پیام‌ها ↓'}
          </button>
        )}
      </div>

      {/* Quick replies */}
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {QUICK_REPLIES.map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => void send(reply)}
            disabled={busy}
            className="shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-card px-3 py-1.5 text-[11px] font-bold text-muted transition hover:border-cta hover:text-ink disabled:opacity-50"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Sticky composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="sticky bottom-16 z-20 mt-2 flex items-end gap-2 rounded-card border border-line bg-card p-2 sm:bottom-0"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
      >
        <label htmlFor="message" className="sr-only">
          متن پیام
        </label>
        <textarea
          id="message"
          className="field max-h-32 min-h-11 flex-1 resize-none py-2"
          rows={1}
          maxLength={2000}
          value={text}
          onChange={(e) => announceTyping(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="پیام خود را بنویسید…"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length === 0}
          aria-label="ارسال پیام"
          className="btn-cta h-11 w-11 shrink-0 p-0 disabled:opacity-50"
        >
          <Icon name="send" size={18} />
        </button>
      </form>

      {error && (
        <p className="error-text mt-1" role="alert">
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
function buildBlocks(messages: ThreadMessage[], _viewerId: string): Block[] {
  const blocks: Block[] = [];
  let currentDay = '';
  let groupKey = '';

  for (const message of messages) {
    const day = dayKey(message.createdAt);
    if (day !== currentDay) {
      currentDay = day;
      groupKey = '';
      blocks.push({ key: `day-${day}-${message.id}`, dateLabel: day, messages: [message] });
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
    <div className="mx-auto flex max-w-2xl animate-pulse flex-col">
      <div className="flex items-center gap-2 rounded-card border border-line bg-card p-2">
        <span className="h-9 w-9 rounded-full bg-line" />
        <span className="h-10 w-10 rounded-full bg-line" />
        <div className="flex-1 space-y-1.5">
          <span className="block h-3 w-28 rounded bg-line" />
          <span className="block h-2.5 w-20 rounded bg-line" />
        </div>
      </div>
      <div className="mt-2 h-14 rounded-card bg-line/60" />
      <div className="mt-2 flex h-[58vh] flex-col gap-2 rounded-card border border-line bg-page p-3">
        <span className="h-8 w-2/3 self-start rounded-2xl bg-line" />
        <span className="h-10 w-1/2 self-end rounded-2xl bg-line" />
        <span className="h-8 w-3/5 self-start rounded-2xl bg-line" />
        <span className="h-12 w-2/3 self-end rounded-2xl bg-line" />
      </div>
    </div>
  );
}
