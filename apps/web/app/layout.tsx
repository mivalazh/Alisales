import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { Header } from '@/components/Header';
import { AppFooter } from '@/components/AppFooter';
import { BottomNav } from '@/components/BottomNav';
import { AppSplashIntro } from '@/components/AppSplashIntro';
import { DeferredAssistant } from '@/components/DeferredAssistant';
import { AppRuntime } from '@/components/AppRuntime';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';
import { BackToTop } from '@/components/BackToTop';
import { themeBootstrapScript } from '@/components/ThemeToggle';
import { PriceUnitProvider } from '@/components/PriceUnitProvider';
import { LocaleProvider } from '@/lib/i18n';
import { getLanguage } from '@/lib/i18n/server';
import { RateProvider } from '@/components/RateProvider';
import { getSession } from '@/lib/auth/session';
import { getAedRate } from '@/lib/data/rate-store';
import { absoluteUrl, SITE_URL } from '@/lib/seo';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || SITE_URL;

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLanguage();
  const isEnglish = lang === 'en';

  return {
    metadataBase: new URL(siteUrl),
    keywords: [
      'خرید خودرو کیش',
      'فروش خودرو کیش',
      'خرید و فروش خودرو و قطعات کیش',
      'اجاره خودرو کیش',
      'رنت ماشین کیش',
      'car marketplace Kish',
      'buy car Kish',
    ],
    openGraph: {
      type: 'website',
      siteName: 'Ali Sales',
      url: absoluteUrl('/'),
      locale: isEnglish ? 'en_US' : 'fa_IR',
    },
    title: {
      default: isEnglish
        ? 'Ali Sales | Buy and sell cars in Kish'
        : 'Ali Sales | آگهی خرید و فروش خودرو در کیش',
      template: '%s | Ali Sales',
    },
    description: isEnglish
      ? 'New and used vehicle listings in Kish and across Iran, with a verified workshop inspection report.'
      : 'بازار آگهی خودروهای نو و کارکرده در جزیره کیش و سراسر ایران؛ همراه با گزارش بازرسی معتبر کارگاه.',
    applicationName: 'Ali Sales',
    authors: [{ name: 'Mahsa Sadr', url: 'https://mivatech.ir' }],
    creator: 'Mahsa Sadr / Miva Tech',
    publisher: 'Miva Tech',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'Ali Sales',
      statusBarStyle: 'black-translucent',
    },
    formatDetection: { telephone: false },
    other: {
      // Official eNamad domain-verification tag (also served as a root file).
      enamad: '34868514',
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'Ali Sales',
    },
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      apple: [
        { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Native controls and the mobile browser chrome follow the same dark switch
  // as the tokens instead of staying cream on a dark page.
  colorScheme: 'light dark',
  viewportFit: 'cover',
  // Installed app chrome and the browser tab both use the brand navy; the
  // page surface stays cream via the theme tokens.
  themeColor: '#111144',
};

/**
 * Shell: header, page content, footer, phone bottom bar.
 *
 * The body is a full-height flex column and `main` takes the leftover space,
 * so a short page (an empty favorites list, a 404, a form) still pins the
 * footer to the bottom of the viewport instead of leaving a gap under it.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [session, aedRate, lang] = await Promise.all([getSession(), getAedRate(), getLanguage()]);

  return (
    <html lang={lang} dir={lang === 'fa' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <head>
        {/* Photo sizing comes from the stylesheet's base layer, which already
            caps every image at its container. It must NOT be repeated as an
            inline <style>: unlayered rules outrank Tailwind's `@layer
            utilities`, so an inline `img{height:auto}` silently beat every
            height utility such as the brand logo's 48px slot. */}
        {/* Apply the stored theme before paint (no light flash). */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {/* Repeat pages in the same session skip the launch overlay pre-paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('alisales-splash-seen'))document.documentElement.dataset.splashSeen='1'}catch(e){}",
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-page font-sans text-ink antialiased">
        <LocaleProvider initialLang={lang}>
        <AppSplashIntro />
        <AppRuntime />
        {/* Field Web Vitals → /api/monitor; renders nothing. */}
        <WebVitalsReporter />
        <RateProvider rate={aedRate}>
          <PriceUnitProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-extrabold focus:text-ink focus:shadow-lg focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-cta"
            >
              رفتن به محتوای اصلی
            </a>
            <Header authed={Boolean(session)} displayName={session?.displayName ?? null} />
            <main
              id="main-content"
              tabIndex={-1}
              className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-4 pb-24 pt-[calc(5rem+env(safe-area-inset-top))] focus:outline-none sm:px-6 sm:pb-6 md:pt-36"
            >
              {children}
            </main>
            <AppFooter />
            <BottomNav />
            <BackToTop />
            <DeferredAssistant />
          </PriceUnitProvider>
        </RateProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
