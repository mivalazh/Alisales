import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { conversationsForUser, listingById } from '@/lib/data/s2-store';
import { Icon } from '@/components/Icon';

export const metadata: Metadata = { title: 'چت‌ها' };

/** Chats (S2): every conversation the signed-in account takes part in. */
export default async function ChatsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/chats');

  const conversations = await conversationsForUser(session.sub);
  const rows = await Promise.all(
    conversations.map(async (conversation) => ({
      conversation,
      listing: await listingById(conversation.listingId),
    })),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">چت‌ها</h1>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong bg-card px-6 py-16 text-center">
          <Icon name="message" size={40} className="mx-auto text-faint" />
          <p className="mt-4 font-extrabold">هنوز گفتگویی ندارید.</p>
          <p className="mt-1 text-sm text-muted">
            از صفحه‌ی هر آگهی می‌توانید گفتگو با آگهی‌دهنده را شروع کنید.
          </p>
          <Link href="/" className="btn-cta mt-6 inline-flex text-sm">
            مرور آگهی‌ها
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map(({ conversation, listing }) => (
            <li key={conversation.id}>
              <Link
                href={`/chats/${conversation.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-card p-4 transition hover:border-line-strong"
              >
                <div className="min-w-0">
                  <p className="truncate font-extrabold">
                    {listing ? `${listing.model} ${listing.year}` : 'آگهی حذف‌شده'}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {conversation.buyerId === session.sub ? 'خریدار' : 'آگهی‌دهنده'}
                    {conversation.lastMessageAt
                      ? ` · ${postingAgeLabel(conversation.lastMessageAt)}`
                      : ' · بدون پیام'}
                  </p>
                </div>
                <Icon name="message" size={20} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
