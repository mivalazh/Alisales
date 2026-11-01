import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'تماس با پشتیبانی' };

export default function SupportPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-4 text-sm leading-7">
      <h1 className="text-xl font-extrabold">تماس با پشتیبانی</h1>
      <p className="text-muted">
        برای گزارش آگهی نامناسب، مشکل در ورود یا سؤال درباره‌ی ثبت آگهی با ما در تماس باشید.
      </p>
      <ul className="space-y-2">
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">ایمیل: </span>
          <span dir="ltr" className="font-mono text-xs">
            support@alisales.example
          </span>
        </li>
        <li className="rounded-card border border-line bg-card p-4">
          <span className="font-bold">ساعات پاسخ‌دهی: </span>
          شنبه تا پنجشنبه، ۹ تا ۱۸
        </li>
      </ul>
      <p className="text-xs text-faint">
        برای پیگیری سریع‌تر، شناسه‌ی آگهی یا شماره موبایل حساب خود را در پیام بنویسید.
      </p>
    </article>
  );
}
