import type { ReactNode } from 'react';

/**
 * Chat screens inherit the same page surface as saved listings and the
 * catalogue. The old white override made the inbox look like a separate
 * product; keeping one surface lets the shared empty state sit on the exact
 * same canvas on /chats and /favorites.
 */
export default function ChatsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F4F1EC] dark:bg-[#0B0D1E]">
      {children}
    </div>
  );
}
