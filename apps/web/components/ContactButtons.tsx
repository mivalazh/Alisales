'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * Detail-page contact actions (D2 rules):
 *  - «چت با آگهی‌دهنده» is visible on every active listing. The chat route
 *    lands in Phase 6, so a tap shows an honest short «بزودی» hint — the
 *    button is never silently disabled.
 *  - «تماس تلفنی» renders only when the server returned a phone number
 *    (get_seller_phone: allow_phone_reveal AND state = 'active'; sold never
 *    yields a number).
 */
export function ContactButtons({ phone }: { phone: string | null }) {
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const showHint = () => {
    setHint(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(false), 2500);
  };

  return (
    <div className="space-y-2">
      <button type="button" onClick={showHint} className="btn-cta w-full text-sm">
        <Icon name="message" size={18} />
        چت با آگهی‌دهنده
      </button>

      {phone && (
        <a href={`tel:${phone}`} className="btn-ghost w-full text-sm">
          <Icon name="phone" size={18} />
          تماس تلفنی
        </a>
      )}

      <p aria-live="polite" className="min-h-5 text-center text-xs font-bold text-note">
        {hint ? 'پیام‌رسان داخلی بزودی ارائه می‌شود.' : ''}
      </p>
    </div>
  );
}
