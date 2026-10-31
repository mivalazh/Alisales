import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatPriceLatin, postingAgeLabel } from '@alisales/schemas';
import { getSession } from '@/lib/auth/session';
import { conversationById, listingById, messagesForConversation } from '@/lib/data/s2-store';
import { ChatThread } from '@/components/ChatThread';

export const metadata: Metadata = { title: 'گفتگو' };

/** A conversation is readable only by its two participants. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/chats');

  const { id } = await params;
  const conversation = await conversationById(id);
  if (
    !conversation ||
    (conversation.buyerId !== session.sub && conversation.sellerId !== session.sub)
  ) {
    redirect('/chats');
  }

  const [messages, listing] = await Promise.all([
    messagesForConversation(conversation.id),
    listingById(conversation.listingId),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold">
            {listing ? `${listing.model} ${listing.year}` : 'گفتگو'}
          </h1>
          {listing && (
            <Link href={`/listing/${listing.slug}`} className="text-xs font-bold text-muted underline">
              {formatPriceLatin(listing.priceIRR)} · {postingAgeLabel(listing.publishedAt ?? Date.now())}
            </Link>
          )}
        </div>
        <Link href="/chats" className="text-xs font-bold text-muted underline">
          همه‌ی چت‌ها
        </Link>
      </div>

      <ChatThread
        conversationId={conversation.id}
        currentUserId={session.sub}
        isSeller={session.sub === conversation.sellerId}
        initialMessages={messages.map((m) => ({
          id: m.id,
          senderId: m.senderId,
          body: m.body,
          createdAt: m.createdAt,
          kind: m.kind,
          visit: m.visit,
        }))}
      />
    </div>
  );
}
