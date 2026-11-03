import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/AdminDashboard';
import { adminGate } from '@/lib/admin/guard';
import { moderationQueues } from '@/lib/data/moderation';

export const metadata: Metadata = { title: 'پنل مدیریت', robots: { index: false, follow: false } };

/**
 * `/admin` — owner moderation hub.
 *
 * Guests are sent to login with a return path; a signed-in visitor who is not
 * on `ADMIN_PHONES` (hosted deployments) gets a plain 404 rather than a
 * "forbidden" page, so the hub never advertises itself.
 *
 * Data is resolved on the server; the browser only receives the queues and
 * posts decisions back to `/api/admin`.
 */
export default async function AdminPage() {
  const { session, access } = await adminGate();
  if (access === 'guest') redirect('/login?next=/admin');
  if (!session || access !== 'admin') notFound();

  const queues = await moderationQueues();
  return <AdminDashboard queues={queues} />;
}
