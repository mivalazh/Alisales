import { readJson } from '../storage/demo-store';
import { hostedDataConfigured } from '../config/mode';

/**
 * Seller reviews.
 *
 * The brief keeps the Supabase schema untouched, and reviews have no table, so
 * they are demo-store data: seeded for the fixture sellers so the profile tab is
 * reviewable, and empty in hosted mode (`reviewsFor` returns [] when Supabase
 * credentials are present) rather than inventing rows that would not survive.
 *
 * The shape is the one a real `seller_reviews` table would carry, so turning
 * this into a query later is a body swap, not a rewrite.
 */
export interface SellerReview {
  id: string;
  sellerId: string;
  authorName: string;
  /** 1–5. */
  rating: number;
  body: string;
  createdAt: string;
  /** The deal the review refers to («بیع پاترول پلاتینیوم»). */
  listingTitle: string | null;
}

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const SEEDED: SellerReview[] = [
  {
    id: 'rev-1',
    sellerId: '00000000-0000-0000-0000-00000000000d',
    authorName: 'مهدی ر.',
    rating: 5,
    body: 'لندکروزر رو دقیقاً همون‌طور که توضیح داده بودند تحویل گرفتم. سند و مدارک مرتب، برخورد حرفه‌ای.',
    createdAt: days(4),
    listingTitle: 'Land Cruiser VXR',
  },
  {
    id: 'rev-2',
    sellerId: '00000000-0000-0000-0000-00000000000d',
    authorName: 'سارا ک.',
    rating: 5,
    body: 'پاسخگویی سریع و صادقانه. بازدید هماهنگ شد و برای معاینه به کارگاه هم بردن. پیشنهاد می‌کنم.',
    createdAt: days(11),
    listingTitle: 'Patrol Platinum',
  },
  {
    id: 'rev-3',
    sellerId: '00000000-0000-0000-0000-00000000000d',
    authorName: 'علی ن.',
    rating: 4,
    body: 'خودرو تمیز بود، فقط مدارک یک روز دیرتر آماده شد. در کل معامله‌ی خوبی بود.',
    createdAt: days(23),
    listingTitle: 'BMW X5 xDrive40i',
  },
  {
    id: 'rev-4',
    sellerId: '00000000-0000-0000-0000-00000000000c',
    authorName: 'رضا م.',
    rating: 5,
    body: 'کیت ترمز اصل بود و فاکتور هم دادند. نصب هم همان‌جا انجام شد.',
    createdAt: days(7),
    listingTitle: 'کیت ترمز سرامیکی پورشه کاین',
  },
  {
    id: 'rev-5',
    sellerId: '00000000-0000-0000-0000-00000000000c',
    authorName: 'نگار ب.',
    rating: 4,
    body: 'قیمت منصفانه و ارسال سریع به بندر. بسته‌بندی هم خوب بود.',
    createdAt: days(18),
    listingTitle: 'ست لاستیک ران‌فلت لکسوس',
  },
];

/** Reviews for a seller: seeded demo rows, or [] on a hosted deployment. */
export async function reviewsFor(sellerId: string): Promise<SellerReview[]> {
  if (hostedDataConfigured()) return [];
  const extra = readJson<SellerReview[]>('reviews.json', () => []);
  return [...extra, ...SEEDED]
    .filter((review) => review.sellerId === sellerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Mean rating (one decimal) or null when nobody has reviewed yet. */
export function averageRating(reviews: readonly SellerReview[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
