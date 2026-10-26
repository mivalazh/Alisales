import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/vazirmatn';
import './globals.css';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { themeBootstrapScript } from '@/components/ThemeToggle';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: 'Alisales | آگهی خرید و فروش خودرو در کیش',
    template: '%s | Alisales',
  },
  description:
    'بازار آگهی خودروهای نو و کارکرده در جزیره کیش و سراسر ایران؛ همراه با گزارش بازرسی معتبر کارگاه.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F4F5F7',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Apply the stored theme before paint (no light flash) */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-screen bg-page font-sans text-ink antialiased">
        <Header />
        <main className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 pb-24 sm:px-6 sm:pb-6 lg:py-8">
          {children}
        </main>
        <footer className="mt-10 border-t border-line bg-card pb-20 sm:pb-0">
          <div className="mx-auto w-full max-w-[var(--content-max)] px-4 py-6 sm:px-6">
            <p className="text-sm text-muted">
              © Alisales — تمامی حقوق محفوظ است. مسئولیت اعلام وضعیت پلاک و صحت
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
