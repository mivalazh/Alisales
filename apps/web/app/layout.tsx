import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { Header } from '@/components/Header';
import { AppFooter } from '@/components/AppFooter';
import { BottomNav } from '@/components/BottomNav';
import { AIAssistantWidget } from '@/components/AIAssistantWidget';
import { themeBootstrapScript } from '@/components/ThemeToggle';
import { PriceUnitProvider } from '@/components/PriceUnitProvider';
import { LocaleProvider } from '@/lib/i18n';
import { RateProvider } from '@/components/RateProvider';
import { getSession } from '@/lib/auth/session';
import { getAedRate } from '@/lib/data/rate-store';

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
  // Native controls and the mobile browser chrome follow the same dark switch
  // as the tokens instead of staying cream on a dark page.
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F1EC' },
    { media: '(prefers-color-scheme: dark)', color: '#101018' },
  ],
};

/**
 * Shell: header, page content, footer, phone bottom bar.
 *
 * The body is a full-height flex column and `main` takes the leftover space,
 * so a short page (an empty favorites list, a 404, a form) still pins the
 * footer to the bottom of the viewport instead of leaving a gap under it.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [session, aedRate] = await Promise.all([getSession(), getAedRate()]);

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before paint (no light flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="flex min-h-screen flex-col bg-page font-sans text-ink antialiased">
        <LocaleProvider>
        <RateProvider rate={aedRate}>
          <PriceUnitProvider>
            <Header authed={Boolean(session)} displayName={session?.displayName ?? null} />
            <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:py-8">
              {children}
            </main>
            <AppFooter />
            <BottomNav />
            <AIAssistantWidget />
          </PriceUnitProvider>
        </RateProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
