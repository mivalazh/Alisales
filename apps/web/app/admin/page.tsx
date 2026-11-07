import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';
import { adminGate } from '@/lib/admin/guard';
import { adminCenterData } from '@/lib/data/admin-center';

export const metadata: Metadata = { title: 'پنل مدیریت', robots: { index: false, follow: false } };

/**
 * `/admin` — the owner control centre.
 *
 * Guests are sent to login with a return path; a signed-in visitor who is not
 * the owner gets a plain 404 rather than a "forbidden" page, so the hub never
 * advertises itself. All five tabs read from one server-side snapshot; the
 * browser only posts decisions back to `/api/admin`.
 */
export default async function AdminPage() {
  const { session, access } = await adminGate();
  if (access === 'guest') redirect('/login?next=/admin');
  if (!session || access !== 'admin') notFound();

  const data = await adminCenterData();
  return <AdminDashboard data={data} />;
}
