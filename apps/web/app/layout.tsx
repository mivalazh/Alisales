import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { Header } from '@/components/Header';
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before paint (no light flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-page font-sans text-ink antialiased">
        <Header authed={Boolean(session)} displayName={session?.displayName ?? null} />
        <main className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:py-8">
          {children}
        </main>
        <footer className="mt-10 border-t border-line bg-card pb-20 sm:pb-0">
          <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 sm:px-6">
            <p className="text-sm text-muted">
              © Ali Sales — تمامی حقوق محفوظ است. مسئولیت اعلام وضعیت پلاک و صحت
              اطلاعات آگهی بر عهده فروشنده است.
            </p>
            <p className="mt-1 text-xs text-faint">جزیره کیش</p>
          </div>
        </footer>
        <BottomNav />
      </body>
    </html>
  );
}
