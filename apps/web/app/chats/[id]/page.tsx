import { localizedMetadata } from '@/lib/i18n/metadata';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import {
  conversationById,
  getUser,
  listingById,
  messagesForConversation,
} from '@/lib/data/s2-store';
import { markRead, readAt } from '@/lib/data/chat-presence';
import { ChatThread, type ChatListingContext } from '@/components/ChatThread';
import { vehicleTitle } from '@/lib/listing-text';
import { translateListingContentToEn } from '@/lib/i18n/content';
import { getLanguage, serverT } from '@/lib/i18n/server';

export const generateMetadata = localizedMetadata(
  { title: 'گفتگو' },
  { title: 'Conversation' },
);

/** Activity we know about for the peer: their last message or read receipt. */
function latest(iso: (string | null | undefined)[]): string | null {
  return (
    iso
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null
  );
}

/**
 * A conversation is readable only by its two participants.
 *
 * The page resolves the *other* participant (name, initials, last activity) and
 * the pinned listing, so the thread can render the messenger header without the
 * client knowing any ids it should not have.
 */
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

  const [messages, listing, lang] = await Promise.all([
    messagesForConversation(conversation.id),
    listingById(conversation.listingId),
    getLanguage(),
  ]);

  const otherId =
    session.sub === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
  const peerAccount = await getUser(otherId);
  const peerMessages = messages.filter((m) => m.senderId === otherId);

  // Opening the thread is the read receipt for this viewer.
  markRead(conversation.id, session.sub);
  const otherReadAt = readAt(conversation.id, otherId);

  const rawPeerName =
    peerAccount?.displayName?.trim() ||
    listing?.showroomName ||
    serverT(lang, 'کاربر آلی‌سیلز', 'Ali Sales user');
  const peerName =
    lang === 'en' ? translateListingContentToEn(rawPeerName) : rawPeerName;
  const initials = rawPeerName.trim().charAt(0) || '؟';

  const rawListingTitle = listing
    ? listing.part
      ? listing.part.title
      : vehicleTitle(listing)
    : '';
  const context: ChatListingContext | null = listing
    ? {
        slug: listing.slug,
        title:
          lang === 'en'
            ? translateListingContentToEn(rawListingTitle)
            : rawListingTitle,
        priceIRR: listing.priceIRR,
        coverUrl: listing.coverUrl,
        sold: listing.state === 'sold',
      }
    : null;

  return (
    <div className="-mb-24 -mt-6 sm:-mb-6 lg:-mt-8">
      <ChatThread
      conversationId={conversation.id}
      currentUserId={session.sub}
      peer={{
        name: peerName,
        initials,
        lastActiveAt: latest([peerMessages.at(-1)?.createdAt, otherReadAt]),
      }}
        listing={context}
        initialOtherReadAt={otherReadAt}
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
