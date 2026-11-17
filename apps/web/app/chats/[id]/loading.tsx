import { CarLoader } from '@/components/CarLoader';

export default function ChatLoading() {
  return (
    <div
      className="flex min-h-[calc(100dvh-14rem)] items-center justify-center"
      aria-busy="true"
      aria-label="Loading chat"
    >
      <CarLoader size="lg" label="Loading chat" />
    </div>
  );
}
