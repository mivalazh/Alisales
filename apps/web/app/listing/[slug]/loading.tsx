import { CarLoader } from '@/components/CarLoader';

export default function ListingLoading() {
  return (
    <div
      className="flex min-h-[calc(100dvh-14rem)] items-center justify-center"
      aria-busy="true"
      aria-label="Loading listing"
    >
      <CarLoader size="lg" label="Loading listing" />
    </div>
  );
}
