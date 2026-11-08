import type { Metadata } from 'next';
import { allRentals } from '@/lib/rentals';
import { RentPortal } from '@/components/RentPortal';

export const metadata: Metadata = {
  title: 'رنت خودرو، اسکوتر و یات در کیش',
  description:
    'اجاره خودرو، اسکوتر برقی و یات تفریحی در کیش با نرخ روزانه، هفتگی و ماهانه، تحویل در فرودگاه، هتل یا مارینا و رزرو آنلاین با محاسبه‌ی هزینه — پورتال رنت Ali Sales.',
};

/**
 * «رنت خودرو و موتور» — the Turo-inspired sister portal.
 *
 * Deliberately its own visual identity (deep navy + ocean blue + acid yellow)
 * and its own data store: rental ads have no sale price, plate or mileage, so
 * they never enter the classifieds feed. The drawer is the only bridge.
 */
export default function RentPage() {
  return <RentPortal rentals={allRentals()} />;
}
