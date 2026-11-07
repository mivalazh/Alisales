import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS, toAsciiDigits } from '@alisales/schemas';
import { searchListings } from '@/lib/data/listings';
import { topFaqTopics, trackFaq } from '@/lib/data/platform-store';

/**
 * Catalog-aware assistant.
 *
 * A deterministic answer engine, not an LLM call: it reads the live catalogue
 * and answers the four things buyers actually ask before contacting a seller —
 * budget recommendations, Kish plate/transit rules, spare-parts availability
 * and the Shamsollah workshop offer. Keeping it rule-based means the reply can
 * never invent a listing or a price, and it costs nothing per message.
 */

interface AssistantListing {
  slug: string;
  title: string;
  priceToman: number;
  city: string;
  coverUrl: string | null;
}

const PLATE_ANSWER =
  'پلاک منطقه آزاد کیش برای تردد در جزیره است و سند آن با خریدار جابه‌جا می‌شود. گذر موقت برای خودروی وارداتی است که هنوز پلاک دائمی نگرفته و باید در مهلت مجاز تمدید شود. برای خروج خودرو از کیش، وضعیت پلاک و عوارض گمرکی را قبل از خرید بررسی کنید.';

const WORKSHOP_ANSWER =
  'کارشناسی تعمیرگاه شمس‌اله شامل موتور، گیربکس، بدنه و دیاگ تخصصی است و برای کاربران سایت ۲۰٪ تخفیف دارد؛ با صدور برگه ضمانت کارشناسی. از صفحه‌ی کارشناسی یا دکمه‌ی رزرو نوبت، تاریخ و ساعت را انتخاب کنید.';

function toman(irr: number): number {
  return Math.round(irr / 10);
}

function pickListings(
  rows: Awaited<ReturnType<typeof searchListings>>,
  limit = 3,
): AssistantListing[] {
  return rows.slice(0, limit).map((listing) => ({
    slug: listing.slug,
    title: listing.part ? listing.part.title : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''} ${listing.year}`,
    priceToman: toman(listing.priceIRR),
    city: listing.city,
    coverUrl: listing.coverUrl,
  }));
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const message =
    typeof (raw as { message?: unknown })?.message === 'string'
      ? ((raw as { message: string }).message.trim().slice(0, 300))
      : '';

  if (!message) {
    return NextResponse.json({ error: 'سؤال خود را بنویسید.' }, { status: 400 });
  }

  const text = toAsciiDigits(message).toLowerCase();
  const catalogue = await searchListings(DEFAULT_FILTERS);
  const active = catalogue.filter((listing) => listing.state !== 'sold');

  // Plate / customs rules.
  if (/پلاک|گذر|منطقه آزاد|گمرک|kish plate|transit/.test(text)) {
    trackFaq('فرق پلاک منطقه آزاد و گذر موقت');
    return NextResponse.json({
      reply: PLATE_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'دیدن خودروهای پلاک منطقه آزاد', href: '/cars?plateType=kish' },
    });
  }

  // Workshop / inspection.
  if (/کارشناسی|شمس|دیاگ|inspection/.test(text)) {
    trackFaq('کارشناسی تعمیرگاه شمس‌اله');
    return NextResponse.json({
      reply: WORKSHOP_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'رزرو کارشناسی با ۲۰٪ تخفیف', href: '/inspection' },
    });
  }

  // Rental portal.
  if (/اجاره|رنت|rent|اسکوتر/.test(text)) {
    trackFaq('اجاره خودرو در کیش');
    return NextResponse.json({
      reply:
        'پورتال «رنت خودرو و موتور» ناوگان لوکس و اسکوترهای برقی کیش را با نرخ روزانه، هفتگی و ماهانه، تحویل فرودگاه/هتل و شرایط ودیعه‌ی شفاف نشان می‌دهد. آگهی‌های اجاره جدا از خرید و فروش‌اند.',
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'ورود به رنت خودرو و موتور', href: '/rent' },
    });
  }

  // Spare parts availability.
  if (/قطعه|باتری|لنت|ترمز|فیلتر|استوک|part/.test(text)) {
    const parts = active.filter((listing) => listing.kind === 'part');
    const word = message.replace(/[؟?]/g, '').trim();
    const matched = parts.filter((listing) =>
      `${listing.part?.title ?? ''} ${listing.part?.compatibility ?? ''} ${listing.part?.originCountry ?? ''}`
        .toLowerCase()
        .includes(word.toLowerCase()),
    );
    const rows = (matched.length > 0 ? matched : parts).slice(0, 3);
    trackFaq('قطعات استوک اصل');
    return NextResponse.json({
      reply:
        rows.length > 0
          ? 'این قطعات الان در فهرست قطعات موجودند؛ روی کارت بزنید تا شماره فنی، سازگاری و اصالت را ببینید.'
          : 'فعلاً قطعه‌ی منطبقی در فهرست نیست؛ فیلتر دسته‌بندی قطعات را ببینید یا درخواست خود را به پشتیبانی بدهید.',
      listings: pickListings(rows),
      faqs: topFaqTopics(),
      cta: { label: 'همه‌ی قطعات', href: '/parts' },
    });
  }

  // Budget: «زیر ۵ میلیارد»، «تا ۳۰۰ میلیون»، «ارزان‌ترین».
  const millionMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(میلیون|میلیارد|تومان|milyon|milyard)/);
  let budgetIRR: number | null = null;
  if (millionMatch) {
    const value = Number(millionMatch[1]?.replace(/,/g, ''));
    if (Number.isFinite(value)) {
      const unit = millionMatch[2];
      const toman = unit === 'میلیارد' || unit === 'milyard' ? value * 1_000_000_000 : value * 1_000_000;
      budgetIRR = toman * 10;
    }
  }

  if (budgetIRR !== null || /ارزان|budget|قیمت مناسب|اقتصادی/.test(text)) {
    const cars = active
      .filter((listing) => listing.kind !== 'part')
      .filter((listing) => (budgetIRR === null ? true : listing.priceIRR <= budgetIRR))
      .sort((a, b) => a.priceIRR - b.priceIRR)
      .slice(0, 3);
    trackFaq('خودروی ارزان کیش');
    return NextResponse.json({
      reply:
        cars.length > 0
          ? `در این محدوده‌ی بودجه، این ${cars.length} خودرو را پیشنهاد می‌کنم؛ همه فعال و آماده‌ی بازدید هستند.`
          : 'در این بودجه خودروی فعالی پیدا نکردم؛ بودجه را کمی بالاتر ببرید یا فیلترها را در صفحه‌ی خودروها ببینید.',
      listings: pickListings(cars),
      faqs: topFaqTopics(),
      cta: { label: 'جستجوی خودرو با فیلتر قیمت', href: '/cars' },
    });
  }

  // Fallback: fuzzy search across the catalogue.
  const words = text.split(/\s+/).filter((word) => word.length > 2);
  const hits = active.filter((listing) => {
    const haystack = `${listing.brand} ${listing.model} ${listing.trim ?? ''} ${listing.part?.title ?? ''}`.toLowerCase();
    return words.some((word) => haystack.includes(word));
  });
  const rows = (hits.length > 0 ? hits : active).slice(0, 3);
  trackFaq('جستجوی خودرو در کیش');
  return NextResponse.json({
    reply:
      hits.length > 0
        ? 'این موارد به سؤال شما نزدیک‌ترین‌اند:'
        : 'دقیقاً چیزی پیدا نکردم، اما این آگهی‌های تازه را ببینید. می‌توانید بودجه، برند یا نوع قطعه را هم بپرسید.',
    listings: pickListings(rows),
    faqs: topFaqTopics(),
    cta: { label: 'همه‌ی آگهی‌ها', href: '/' },
  });
}
