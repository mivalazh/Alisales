'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from './Footer';

/**
 * Route-aware footer.
 *
 * Chats, favorites, login and the publish/edit forms are app screens: a
 * marketing footer under a full-height conversation list only adds dead space
 * and a second scroll target. Everything else (home, the four catalogs, listing
 * pages) keeps the footer.
 */
const APP_ROUTES = ['/chats', '/favorites', '/new', '/edit', '/login'];

export function AppFooter() {
  const pathname = usePathname() ?? '/';
  const isAppScreen = APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (isAppScreen) return null;
  return <SiteFooter />;
}
