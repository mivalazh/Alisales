import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import {
  conversationsForUser,
  getUser,
  listingById,
  messagesForConversation,
} from '@/lib/data/s2-store';
import { Icon } from '@/components/Icon';
import { vehicleTitle } from '@/lib/listing-text';

export const metadata: Metadata = { title: 'چت‌ها' };

/**
 * Chats list — a messenger inbox, not a table of records: avatar, the other
 * participant's name, the last message preview, the listing it belongs to and
 * when it last moved. Every conversation the signed-in account takes part in.
 */
export default async function ChatsPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/chats');

  const conversations = await conversationsForUser(session.sub);
  const rows = await Promise.all(
    conversations.map(async (conversation) => {
      const otherId =
        conversation.buyerId === session.sub ? conversation.sellerId : conversation.buyerId;
      const [listing, messages, peer] = await Promise.all([
        listingById(conversation.listingId),
        messagesForConversation(conversation.id),
        getUser(otherId),
      ]);
      const last = messages.at(-1);
      const name = peer?.displayName?.trim() || listing?.showroomName || 'کاربر آلی‌سیلز';
      return {
        conversation,
        listing,
        last,
        name,
        initials: name.trim().charAt(0) || '؟',
      };
    }),
  );

  rows.sort((a, b) => {
    const at = a.last?.createdAt ?? a.conversation.createdAt;
    const bt = b.last?.createdAt ?? b.conversation.createdAt;
    return bt.localeCompare(at);
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
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
        <ul className="flex flex-col gap-2">
          {rows.map(({ conversation, listing, last, name, initials }) => (
            <li key={conversation.id}>
              <Link
                href={`/chats/${conversation.id}`}
                className="flex items-center gap-3 rounded-card border border-line bg-card p-3 transition hover:border-line-strong"
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta-soft text-sm font-extrabold text-ink"
                >
                  {initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-extrabold text-ink">{name}</span>
                    <span className="shrink-0 text-[10px] font-bold text-faint">
                      {postingAgeLabel(last?.createdAt ?? conversation.createdAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {last?.body ?? 'بدون پیام — اولین پیام را بفرستید.'}
                  </span>
                  {listing && (
                    <span className="mt-0.5 block truncate text-[11px] font-bold text-faint">
                      {listing.part ? listing.part.title : vehicleTitle(listing)}
                    </span>
                  )}
                </span>
                <Icon name="chevronLeft" size={16} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
