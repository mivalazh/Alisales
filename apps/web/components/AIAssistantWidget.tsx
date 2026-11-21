'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';
import { useDelayedBusy } from '@/lib/useDelayedBusy';
import { useModalFocus } from '@/lib/useModalFocus';

interface MessageListing {
  slug: string;
  title: string;
  priceToman: number;
  city: string;
  coverUrl: string | null;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  listings?: MessageListing[];
  cta?: { label: string; href: string };
}

const SMART_CHIPS = [
  'راهنمای خرید خودرو مناسب بودجه من',
  'مقایسه پلاک منطقه آزاد کیش و گذر موقت',
  'بهترین اسکوتر برقی برای تردد در کیش',
  'نکات مهم کارشناسی و سلامت شاسی',
];

/**
 * Floating catalog assistant.
 *
 * Bottom-right circle that opens an RTL chat. Answers come from
 * `/api/assistant`, which searches the live catalogue — so every listing card
 * inside a bubble is a real ad with its real Toman price. There is deliberately
 * no «transfer to support» button: the widget answers, it does not open tickets.
 */
export function AIAssistantWidget() {
  const { t, lang } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const showBusy = useDelayedBusy(busy);
  // Two lines on purpose: a bare greeting, then one sentence of introduction.
  // `whitespace-pre-line` on the bubble renders the break without a second
  // message; translate the intro line by line so both stay in sync.
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: t(
        'سلام 👋🏻\nمن دستیار هوش مصنوعی Ali Sales هستم، چطور می‌توانم کمکتان کنم؟',
        'Hi 👋🏻\nI am the Ali Sales AI assistant — how can I help you?',
      ),
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  // The sheet is modal: the page is inert behind it, Tab stays inside, Escape
  // closes it and focus returns to the orb that opened it.
  // The orb is unmounted while the sheet is open, so closing restores focus to
  // the orb that reappears in its place.
  useModalFocus({ active: open, containerRef: sheet, onClose: () => setOpen(false), restoreTarget: '[data-assistant-trigger]' });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open, busy]);

  // A focused conversation owns the composer edge; the catalogue assistant
  // would otherwise float over the message input on a phone. `/support` is the
  // help surface itself: its two-column guide grid runs under the orb's corner,
  // so the fixed orb sat on top of the first card's «خواندن راهنما» action at
  // 375px. No fixed corner is free there, so the orb stands down on that page.
  if (/^\/chats\/[^/]+/.test(pathname ?? '') || pathname === '/support') return null;

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setMessages((current) => [...current, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q, lang }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        reply?: string;
        listings?: MessageListing[];
        faqs?: string[];
        cta?: { label: string; href: string };
        error?: string;
      };
      if (!res.ok || !body.reply) {
        setMessages((current) => [
          ...current,
          {
            role: 'assistant',
            text: body.error ?? t('فعلاً نتوانستم جواب بدهم؛ دوباره بپرسید.', 'I could not answer that just now. Please try again.'),
          },
        ]);
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: body.reply!,
          listings: body.listings ?? [],
          ...(body.cta ? { cta: body.cta } : {}),
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          text: t('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.', 'Could not reach the server. Please try again.'),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div
          ref={sheet}
          role="dialog"
          aria-modal="true"
          aria-label={t('دستیار هوشمند Ali Sales')}
          tabIndex={-1}
          className="fixed bottom-24 right-4 z-50 flex h-[390px] max-h-[60dvh] w-[calc(100vw-2rem)] max-w-[340px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:bottom-6 sm:right-6 sm:h-[460px] sm:max-h-[72dvh] sm:max-w-[380px]"
        >
          <div className="flex items-center gap-2 bg-[#111144] px-3 py-2.5 text-white">
            <span className="ai-orb ai-orb-sm shrink-0" aria-hidden="true">
              <span className="ai-orb-eye" />
              <span className="ai-orb-eye" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">{t('دستیار هوشمند Ali Sales')}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('بستن دستیار')}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
            >
              <Icon name="close" size={15} />
            </button>
          </div>

          <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <p
                  key={index}
                  className="ms-auto w-fit max-w-[86%] rounded-2xl rounded-br-sm bg-[#111144] px-2.5 py-1.5 text-[11px] font-bold leading-5 text-white"
                >
                  {message.text}
                </p>
              ) : (
                <div key={index} className="w-fit max-w-[90%] space-y-1.5">
                  <p className="whitespace-pre-line rounded-2xl rounded-bl-sm bg-page px-2.5 py-1.5 text-[11px] leading-5 text-ink">
                    {message.text}
                  </p>
                  {message.listings && message.listings.length > 0 && (
                    <ul className="space-y-1.5">
                      {message.listings.map((listing) => (
                        <li key={listing.slug}>
                          <Link
                            href={`/listing/${listing.slug}`}
                            className="flex items-center gap-2 rounded-xl border border-line bg-card p-1.5 transition hover:border-cta"
                          >
                            <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-sunken">
                              {listing.coverUrl ? (
                                <Image
                                  src={listing.coverUrl}
                                  alt=""
                                  fill
                                  sizes="44px"
                                  className="h-11 w-11 rounded-lg object-cover"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-faint">
                                  <Icon name="imageX" size={15} />
                                  <span className="sr-only">No image</span>
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-extrabold text-ink">
                                {listing.title}
                              </span>
                              <span dir="ltr" className="mt-0.5 block text-[10px] font-extrabold text-[#B45309] dark:text-[#F98513]">                                  {listing.priceToman.toLocaleString('en-US')} {t('تومان')}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.cta && (
                    <Link
                      href={message.cta.href}
                      className="inline-flex rounded-[var(--radius-pill)] border border-cta bg-cta-soft px-2.5 py-1 text-[10px] font-extrabold text-ink"
                    >
                      {message.cta.label}
                    </Link>
                  )}
                </div>
              ),
            )}
            {showBusy && (
              <div
                role="status"
                aria-live="polite"
                className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-page px-3 py-2.5"
              >
                <span className="flex items-center gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cta [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cta [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cta" />
                </span>
                <span className="sr-only">{t('در حال فکر کردن', 'Thinking')}</span>
              </div>
            )}
          </div>

          {!messages.some((message) => message.role === 'user') && (
            <div className="shrink-0 border-t border-line px-2.5 py-2">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SMART_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void ask(chip)}
                    className="shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-page px-2.5 py-1.5 text-[10px] font-bold text-muted transition hover:border-cta hover:text-ink"
                  >
                    {t(chip)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-1.5 border-t border-line p-2"
          >
            {/* 16px keeps iOS Safari from zooming the page when the composer
                takes focus; anything under 16px forces an auto-zoom. */}
            <input
              className="field h-11 flex-1 text-[16px] leading-6"
              inputMode="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder={t('سؤال‌تان را بنویسید…')}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label={t('سؤال از دستیار')}
            />
            {/* High-contrast circular send. The old pale chevron read as a
                «previous» control, not as the action that submits the question;
                an upward arrow is the send affordance on every chat surface. */}
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t('ارسال', 'Send')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F98513] text-white shadow-xs transition-all hover:bg-[#e0740c] active:scale-95 disabled:opacity-50"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12 19V5" />
                <path d="M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          data-assistant-trigger=""
          aria-label={t('باز کردن دستیار هوشمند')}
          className="ai-fab fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#F98513]/70 bg-[#111144] shadow-[0_12px_30px_-4px_rgba(249,133,19,0.5),0_6px_16px_-2px_rgba(17,17,68,0.4)] ring-2 ring-[#F98513]/70 transition-all duration-200 hover:-translate-y-1 sm:bottom-6 sm:right-6"
        >
          <span className="ai-orb" aria-hidden="true">
            <span className="ai-orb-eye" />
            <span className="ai-orb-eye" />
          </span>
        </button>
      )}
    </>
  );
}
