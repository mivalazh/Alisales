import { CarLoader } from '@/components/CarLoader';

export default function FavoritesLoading() {
  return (
    <div
      className="flex min-h-[55vh] items-center justify-center px-4"
      aria-busy="true"
      aria-label="Loading saved listings"
    >
      <CarLoader />
    </div>
  );
}
