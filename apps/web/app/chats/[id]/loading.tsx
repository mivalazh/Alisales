import { ChatThreadSkeleton } from '@/components/ChatThread';

/** Route-level loading state: the messenger's own skeleton, not a spinner. */
export default function ChatLoading() {
  return <ChatThreadSkeleton />;
}
