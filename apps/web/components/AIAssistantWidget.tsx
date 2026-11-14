'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Icon } from './Icon';
import { CarLoader } from './CarLoader';

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

const SEED_FAQS = [
  'چه موتوری برای مسافت بلند خوبه؟',
  'چه ماشینی بخرم؟',
  'خودروی ارزان کیش',
  'فرق پلاک منطقه آزاد و گذر موقت',
  'چک‌لیست کارشناسی پیش از خرید',
  'قطعات استوک اصل',
  'چک‌لیست خرید خودرو',
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
  const [faqs, setFaqs] = useState<string[]>(SEED_FAQS);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: t(
        'سلام! من دستیار Ali Sales هستم؛ خودرو، اسکوتر، ماشین‌آلات، قطعات و پلاک کیش. بودجه یا سؤال فنی‌تان را بگویید تا دقیق راهنمایی کنم.',
        'Hi! I am the Ali Sales consultant for cars, scooters, heavy machinery, spare parts and Kish plates. Tell me your budget or technical question and I will narrow it down.',
      ),
    },
  ]);
  const scroller = useRef<HTMLDivElement>(null);

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
  // would otherwise float over the message input on a phone.
  if (/^\/chats\/[^/]+/.test(pathname ?? '')) return null;

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
      if (body.faqs?.length) setFaqs(body.faqs);
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
          role="dialog"
          aria-label={t('دستیار هوشمند Ali Sales')}
          className="fixed bottom-24 right-3 z-50 flex h-[520px] max-h-[80dvh] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:right-6 sm:w-[420px] md:w-[450px]"
        >
          <div className="flex items-center gap-2 bg-[#111144] px-3 py-2.5 text-white">
            <span className="ai-orb ai-orb-sm shrink-0" aria-hidden="true">
              <span className="ai-orb-eye" />
              <span className="ai-orb-eye" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold">{t('دستیار هوشمند Ali Sales')}</p>
              <p className="text-[9px] text-white/60">{t('جستجو در کاتالوگ زنده — همیشه بیدار')}</p>
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

          <div className="border-b border-line px-2.5 py-2">
            <p className="mb-1.5 text-[10px] font-extrabold text-faint">{t('سوالات پرتکرار کاربران')}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {faqs.map((faq) => (
                <button
                  key={faq}
                  type="button"
                  onClick={() => void ask(faq)}
                  className="shrink-0 whitespace-nowrap rounded-[var(--radius-pill)] border border-line bg-page px-2.5 py-1 text-[10px] font-bold text-muted transition hover:border-cta hover:text-ink"
                >
                  {t(faq)}
                </button>
              ))}
            </div>
          </div>

          <div ref={scroller} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.map((message, index) =>
              message.role === 'user' ? (
                <p
                  key={index}
                  className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-[#111144] px-3 py-2 text-xs font-bold leading-6 text-white"
                >
                  {message.text}
                </p>
              ) : (
                <div key={index} className="w-fit max-w-[92%] space-y-2">
                  <p className="rounded-2xl rounded-bl-sm bg-page px-3 py-2 text-xs leading-6 text-ink">
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
                            <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-lg bg-sunken">
                              {listing.coverUrl ? (
                                <Image
                                  src={listing.coverUrl}
                                  alt={listing.title}
                                  fill
                                  sizes="56px"
                                  className="object-cover"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[8px] text-faint">
                                  No image
                                </span>
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-extrabold text-ink">
                                {listing.title}
                              </span>
                              <span dir="ltr" className="mt-0.5 block text-[10px] font-extrabold text-[#F98513]">                                  {listing.priceToman.toLocaleString('en-US')} {t('تومان')}
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
            {busy && (
              <div
                role="status"
                aria-live="polite"
                className="w-fit max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-page px-3 py-2.5"
              >
                <CarLoader size="sm" label={t('در حال فکر کردن', 'Thinking')} />
                <span className="mt-0.5 block animate-pulse bg-gradient-to-l from-faint via-ink to-faint bg-clip-text text-[10px] font-bold text-transparent">
                  {t('در حال تحلیل کاتالوگ و مشخصات فنی...')}
                </span>
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(input);
            }}
            className="flex items-center gap-1.5 border-t border-line p-2"
          >
            <input
              className="field h-9 flex-1 text-xs"
              placeholder={t('سؤال‌تان را بنویسید…')}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label={t('سؤال از دستیار')}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label={t('ارسال', 'Send')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F98513] text-white transition hover:bg-[#e0770f] disabled:opacity-50"
            >
              <Icon name="chevronLeft" size={17} />
            </button>
          </form>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-label={t('باز کردن دستیار هوشمند')}
          className="ai-fab fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#F98513]/70 bg-[#111144] shadow-[0_12px_30px_-4px_rgba(249,133,19,0.5),0_6px_16px_-2px_rgba(17,17,68,0.4)] ring-2 ring-[#F98513]/70 transition-all duration-200 hover:-translate-y-1 sm:bottom-6 sm:right-6"
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
