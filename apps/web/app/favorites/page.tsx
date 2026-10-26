import type { Metadata } from 'next';
import { FavoritesList } from '@/components/FavoritesList';

export const metadata: Metadata = { title: 'علاقه‌مندی‌ها' };

/** Favorites — stored on the device until accounts land in Phase 4. */
export default function FavoritesPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold">علاقه‌مندی‌ها</h1>
      <FavoritesList />
    </div>
  );
}
