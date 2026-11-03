import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { Header } from '@/components/Header';
import { SiteFooter } from '@/components/Footer';
import { BottomNav } from '@/components/BottomNav';
import { themeBootstrapScript } from '@/components/ThemeToggle';
import { getSession } from '@/lib/auth/session';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: 'Ali Sales | آگهی خرید و فروش خودرو در کیش',
    template: '%s | Ali Sales',
  },
  description:
    'بازار آگهی خودروهای نو و کارکرده در جزیره کیش و سراسر ایران؛ همراه با گزارش بازرسی معتبر کارگاه.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F4F1EC',
};

/**
 * Shell: header, page content, footer, phone bottom bar.
 *
 * The body is a full-height flex column and `main` takes the leftover space,
 * so a short page (an empty favorites list, a 404, a form) still pins the
 * footer to the bottom of the viewport instead of leaving a gap under it.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before paint (no light flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-page font-sans text-ink antialiased">
        <Header authed={Boolean(session)} displayName={session?.displayName ?? null} />
        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:py-8">
          {children}
        </main>
        <SiteFooter />
        <BottomNav />
      </body>
    </html>
  );
}
