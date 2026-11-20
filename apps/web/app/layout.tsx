import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { INITIAL_SPLASH_CSS } from './initial-splash';
import { Header } from '@/components/Header';
import { AppFooter } from '@/components/AppFooter';
import { BottomNav } from '@/components/BottomNav';
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

/**
 * Solid cream launch image for iOS.
 *
 * iOS draws its own white web-view background until the first paint, which is
 * the 4–5s white flash on a cold PWA launch. A `apple-touch-startup-image`
 * takes over that window: a 64×64 PNG of the warm brand canvas (#F4F1EC),
 * stretched to the device, so the app opens on cream instead of white. It is
 * inlined as a data URI (138 bytes) rather than shipped as a file per device
 * size, and the media queries pick the matching portrait geometry.
 */
const SPLASH_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAUUlEQVR42u3PMQ0AMAgAMJh/qTwkCJgKDpLWQXO64rIXxwkICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAjs+yeSA1GhmyR6AAAAAElFTkSuQmCC';

const STARTUP_IMAGES = [
  '(device-width: 440px) and (device-height: 956px)',
  '(device-width: 430px) and (device-height: 932px)',
  '(device-width: 428px) and (device-height: 926px)',
  '(device-width: 414px) and (device-height: 896px)',
  '(device-width: 402px) and (device-height: 874px)',
  '(device-width: 393px) and (device-height: 852px)',
  '(device-width: 390px) and (device-height: 844px)',
  '(device-width: 375px) and (device-height: 812px)',
  '(device-width: 375px) and (device-height: 667px)',
].map((geometry) => ({ url: SPLASH_IMAGE, media: `${geometry} and (orientation: portrait)` }));

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
      startupImage: STARTUP_IMAGES,
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
        {/* The launch splash is pure HTML+CSS with its own inline style block,
            so it must not depend on the stylesheet arriving. This pre-paint
            script only decides whether this is the first page of the session;
            repeat pages hide the layer before anything is painted. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('alisales-splash-seen'))document.documentElement.dataset.splashSeen='1';else sessionStorage.setItem('alisales-splash-seen','1')}catch(e){}",
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: INITIAL_SPLASH_CSS }} />
      </head>
      <body className="flex min-h-screen flex-col bg-page font-sans text-ink antialiased">
        {/* Frame-1 brand paint: server HTML + inline CSS, no JS and no
            hydration. It covers the first ~0.8s and fades over the shell. */}
        <div id="ali-initial-splash" aria-hidden="true">
          <span className="ali-splash-mark" dir="ltr">
            <svg viewBox="80 90 352 320" width={352} height={320} aria-hidden="true" focusable="false">
              <path d="M 234 114 H 278 L 366 303 C 345 294 323 289 301 287 L 255 186 L 209 287 C 185 290 163 296 144 304 L 234 114 Z" fill="#223382" />
              <path d="M 142 311 C 198 287 284 285 369 309 C 287 296 196 306 123 352 L 142 311 Z" fill="#F98513" />
              <path d="M 107 386 C 165 328 258 296 370 318 C 339 316 311 319 288 326 C 303 331 314 340 322 356 L 336 386 H 404 L 377 328 C 352 321 319 321 288 326 C 234 335 194 358 168 386 H 107 Z" fill="#F98513" />
            </svg>
            <span className="ali-splash-word">
              <span>ALI</span>
              <span className="ali-splash-sales">SALES</span>
            </span>
            {/* Orange light sweep across the lockup. */}
            <span className="ali-splash-sweep" aria-hidden="true" />
          </span>
        </div>
        <LocaleProvider initialLang={lang}>
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
