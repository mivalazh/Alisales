'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Active-tab detection shared by the header and the bottom bar.
 *
 * A destination stays highlighted on its own sub-routes (`/chats/[id]`,
 * `/profile/listings`), and also while the guest is being sent to sign in:
 * `/login?next=/chats` marks «چت‌ها» active instead of dropping the bar back to
 * gray. The `next` target is read from `window.location` in an effect rather
 * than `useSearchParams`, so the header keeps working inside statically
 * rendered pages without a Suspense boundary.
 */
export function useActivePath(): (href: string) => boolean {
  const pathname = usePathname();
  const [nextTarget, setNextTarget] = useState('');

  useEffect(() => {
    try {
      setNextTarget(new URLSearchParams(window.location.search).get('next') ?? '');
    } catch {
      setNextTarget('');
    }
  }, [pathname]);

  return (href: string): boolean => {
    if (href === '/') return pathname === '/';
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      nextTarget.startsWith(href)
    );
  };
}
