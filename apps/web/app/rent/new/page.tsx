import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { RentForm } from '@/components/RentForm';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'ثبت آگهی اجاره | رنت' };

/** Post a car/scooter rental — signed-in users only, straight into /rent. */
export default async function RentNewPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/rent/new');

  return (
    <div className="-mx-4 -mt-6 bg-[#F6F4EE] px-4 py-6 sm:-mx-6 sm:px-6 dark:bg-[#0d1512]">
      <div className="mx-auto max-w-xl space-y-4">
        <Link
          href="/rent"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#064E3B] transition hover:text-[#047857] dark:text-white/80"
        >
          <Icon name="arrowLeft" size={18} />
          بازگشت به پورتال رنت
        </Link>
        <header>
          <h1 className="text-xl font-extrabold text-[#0b2e24] dark:text-white">
            ثبت آگهی اجاره در کیش
          </h1>
          <p className="mt-1 text-xs leading-6 text-[#0b2e24]/70 dark:text-white/60">
            نرخ‌ها به تومان ثبت می‌شوند و کنار معادل درهم نمایش داده می‌شوند. آگهی شما فقط
            در پورتال رنت دیده می‌شود و به فهرست خرید و فروش نمی‌رود.
          </p>
        </header>
        <RentForm />
      </div>
    </div>
  );
}
