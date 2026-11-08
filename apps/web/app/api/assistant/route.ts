import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS, fuzzySearchMatch, toAsciiDigits } from '@alisales/schemas';
import { searchListings } from '@/lib/data/listings';
import { allRentals } from '@/lib/rentals';
import { topFaqTopics, trackFaq } from '@/lib/data/platform-store';

/**
 * Catalog-aware domain expert.
 *
 * A deterministic answer engine, not an LLM call: it reads the live catalogue
 * and answers the questions buyers actually ask — budget, plate/customs rules,
 * model comparisons, insurance/chassis checks, rentals/yachts and the Shamsollah
 * workshop. Keeping it rule-based means a reply can never invent a listing or a
 * price, and it costs nothing per message.
 */

interface AssistantListing {
  slug: string;
  title: string;
  priceToman: number;
  city: string;
  coverUrl: string | null;
}

const PLATE_ANSWER =
  'پلاک منطقه آزاد کیش برای تردد در جزیره است و سند آن با خریدار جابه‌جا می‌شود. گذر موقت برای خودروی وارداتی است که هنوز پلاک دائمی نگرفته و باید در مهلت مجاز تمدید شود. برای خروج خودرو از کیش، وضعیت پلاک، عوارض گمرکی و مهلت گذر موقت را قبل از خرید مکتوب بگیرید.';

const WORKSHOP_ANSWER =
  'کارشناسی تعمیرگاه تخصصی شمس‌اله شامل موتور، گیربکس، بدنه، شاسی و دیاگ تخصصی است و برای کاربران سایت ۲۰٪ تخفیف دارد؛ با صدور برگه ضمانت کارشناسی. برخلاف برچسب «کارشناسی‌شده» روی آگهی‌ها، این بازرسی با حضور خریدار و به‌صورت حضوری انجام می‌شود. از صفحه‌ی کارشناسی یا دکمه‌ی رزرو نوبت، تاریخ و ساعت را انتخاب کنید.';

const BUYING_CHECKLIST =
  'چک‌لیست خرید در کیش: ۱) تطابق شماره شاسی و VIN با سند، ۲) وضعیت شاسی (پلمپ جلو و عقب) و رنگ‌شدگی، ۳) بیمه شخص ثالث و بدنه و باقی‌مانده آن، ۴) معاینه فنی معتبر، ۵) کارکرد واقعی و سرویس‌های نمایندگی، ۶) وضعیت پلاک کیش یا مهلت گذر موقت، ۷) مالیات و عوارض منطقه آزاد. اگر seller برگه کارشناسی دارد، باز هم قبل از پرداخت، کارشناسی حضوری شمس‌اله را بگیرید.';

const INSURANCE_ANSWER =
  'برای خودروی وارداتی، بیمه شخص ثالث اجباری است و بدنه ارزش خودرو را پوشش می‌دهد. باقی‌مانده بیمه را روی برگه ببینید؛ خودرویی که «بیمه دارد» ولی دو ماه تا انقضا دارد، هزینه تمدید را به قیمت اضافه می‌کند. در فیلترها می‌توانید «بیمه شخص ثالث دارد» یا «بیمه بدنه دارد» را انتخاب کنید و در مشخصات تکمیلی آگهی، وضعیت رنگ و شاسی را ببینید.';

const RENTAL_ANSWER =
  'پورتال رنت سه ناوگان دارد: خودروهای لوکس و کروک، اسکوترهای برقی، و یات/قایق تفریحی. رزرو با محاسبه‌ی هزینه بر اساس روز انجام می‌شود؛ تحویل در فرودگاه کیش، لابی هتل، مارینا یا دفتر رنت. برای یات، کاپیتان و ظرفیت نفرات در نرخ لحاظ شده و ودیعه جداگانه است. آگهی‌های اجاره در فهرست خرید و فروش نمی‌آیند.';

const PROFANITY_REPLY =
  'این لحن به جایی نمی‌رسد، رفیق. من اینجا هستم که کمک کنم ماشین یا یات درست را پیدا کنی، نه اینکه با هم کل‌کل کنیم. بودجه، برند یا نوع کاربری‌ات را بگو تا با هم یه انتخاب تمیز دربیاوریم.';

const PROFANITY_REPLY_EN =
  "That tone won't get us anywhere. I'm here to find you the right car or yacht, not to trade insults. Tell me your budget, brand or use case and we'll pick something sensible.";

/** Persian + English profanity/insult gate. */
function isAbusive(text: string): boolean {
  return /(کونی|کسکش|کسکش|کیر|جنده|حرومزاده|مادرجنده|خفه شو|گه بخور|احمق|ابله|احمقی|کیخدا|fuck|motherfucker|bitch|asshole|idiot|shut up|dumbass|bastard)/i.test(
    text,
  );
}

function toman(irr: number): number {
  return Math.round(irr / 10);
}

function pickListings(
  rows: Awaited<ReturnType<typeof searchListings>>,
  limit = 3,
): AssistantListing[] {
  return rows.slice(0, limit).map((listing) => ({
    slug: listing.slug,
    title: listing.part
      ? listing.part.title
      : `${listing.model}${listing.trim ? ` ${listing.trim}` : ''} ${listing.year}`,
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

  // A composed, firm boundary — never a crash or a robotic error page.
  if (isAbusive(text)) {
    return NextResponse.json({
      reply: /^[\x00-\x7F\s]+$/.test(message) ? PROFANITY_REPLY_EN : PROFANITY_REPLY,
      listings: [],
      faqs: topFaqTopics(),
    });
  }

  // Rentals / yachts — the sister portal, not the sales catalogue.
  if (/یات|قایق|مارینا|چارتر|yacht|boat|مارينا/.test(text)) {
    const yachts = allRentals().filter((rental) => rental.kind === 'yacht');
    trackFaq('اجاره یات و قایق در کیش');
    return NextResponse.json({
      reply:
        yachts.length > 0
          ? `${RENTAL_ANSWER} در حال حاضر ${yachts.length} یات فعال داریم؛ مثلاً ${yachts
              .slice(0, 2)
              .map((y) => `${y.title} با ظرفیت ${y.capacity ?? 10} نفر`)
              .join(' و ')}.`
          : RENTAL_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'دیدن یات‌ها و قایق‌های کیش', href: '/rent?kind=yacht' },
    });
  }

  if (/اجاره|رنت|اسکوتر برقی|سوکو|niu|rent/.test(text)) {
    trackFaq('اجاره خودرو در کیش');
    return NextResponse.json({
      reply: RENTAL_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'ورود به پورتال رنت', href: '/rent' },
    });
  }

  // Model comparisons a buyer actually asks about.
  if (/لندکروزر|لندکروز|land ?cruiser/.test(text) && /پاترول|patrol/.test(text)) {
    return NextResponse.json({
      reply:
        'لندکروزر VXR سواری نرم‌تر، قطعات فراوان‌تر و ارزش فروش بالاتری دارد؛ پاترول پلاتینیوم موتور قوی‌تر و مصرف بالاتر، با تعلیق راحت‌تر در آفرود. برای کیش و مسیرهای ساحلی، لندکروزر کم‌دردسرتر است؛ اگر آفرود جدی می‌خواهید، پاترول با لاستیک مناسب انتخاب خوبی است. هر دو را قبل از خرید با کارشناسی شاسی و گیربکس چک کنید.',
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'مقایسه با فیلتر برند', href: '/cars?brand=toyota,nissan' },
    });
  }
  if (/niu|نیو/.test(text) && /سوکو|soco/.test(text)) {
    return NextResponse.json({
      reply:
        'NIU NQi GT باتری قابل حمل، اپلیکیشن و شبکه خدمات بهتری دارد و برای تردد شهری کیش نرم‌تر است. Super Soco TC Max سریع‌تر و موتورمحورتر است و برای مسیرهای طولانی‌تر حس بهتری می‌دهد. برای اجاره روزانه، NIU سبک‌تر و کم‌هزینه‌تر است؛ برای هیجان، TC Max.',
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'اسکوترهای برقی', href: '/motorcycles' },
    });
  }

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
  if (/کارشناسی|شمس|دیاگ|inspection|برگه/.test(text)) {
    trackFaq('کارشناسی تعمیرگاه شمس‌اله');
    return NextResponse.json({
      reply: WORKSHOP_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'رزرو کارشناسی با ۲۰٪ تخفیف', href: '/inspection' },
    });
  }

  // Buying checklist / paint / chassis / insurance advice.
  if (/چک.?لیست|چگونه بخرم|راهنمای خرید|شاسی|رنگ|بدنه|بیمه|معاینه فنی|checklist|chassis|insurance/.test(text)) {
    return NextResponse.json({
      reply: /بیمه|insurance/.test(text)
        ? INSURANCE_ANSWER
        : /شاسی|رنگ|بدنه|chassis|paint/.test(text)
          ? `وضعیت رنگ و شاسی مهم‌ترین بخش بازرسی است: شاسی پلمپ جلو و عقب یعنی بدون ضربه‌ی ساختاری؛ «دوررنگ» یا «تعویض استوک» باید با برگه کارشناسی و اختلاف قیمت همراه باشد. ${BUYING_CHECKLIST}`
          : BUYING_CHECKLIST,
      listings: [],
      faqs: topFaqTopics(),
      cta: { label: 'فیلتر خودروهای شاسی‌پلمپ', href: '/cars?chassisCondition=sealed' },
    });
  }

  const catalogue = await searchListings(DEFAULT_FILTERS);
  const active = catalogue.filter((listing) => listing.state !== 'sold');

  // Spare parts availability.
  if (/قطعه|باتری|لنت|ترمز|فیلتر|استوک|part/.test(text)) {
    const parts = active.filter((listing) => listing.kind === 'part');
    const matched = parts.filter((listing) =>
      fuzzySearchMatch(
        `${listing.part?.title ?? ''} ${listing.part?.compatibility ?? ''} ${listing.part?.originCountry ?? ''}`,
        message,
      ),
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
  const millionMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(میلیون|میلیارد|تومان|million|billion)/);
  let budgetIRR: number | null = null;
  if (millionMatch) {
    const value = Number(millionMatch[1]?.replace(/,/g, ''));
    if (Number.isFinite(value)) {
      const unit = millionMatch[2];
      const tomanAmount =
        unit === 'میلیارد' || unit === 'billion'
          ? value * 1_000_000_000
          : value * 1_000_000;
      budgetIRR = tomanAmount * 10;
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

  // Live fuzzy search across the whole catalogue (all categories + parts).
  // No fallback cards: an honest «پیدا نکردم» beats irrelevant listings.
  const hits = active.filter((listing) =>
    fuzzySearchMatch(
      [
        listing.brand,
        listing.model,
        listing.trim ?? '',
        listing.color,
        listing.part?.title ?? '',
        listing.part?.compatibility ?? '',
        listing.category ?? '',
        listing.paintCondition ?? '',
        listing.chassisCondition ?? '',
      ].join(' '),
      message,
    ),
  );
  const rows = hits.slice(0, 3);
  trackFaq('جستجوی خودرو در کیش');
  return NextResponse.json({
    reply:
      rows.length > 0
        ? 'این موارد به سؤال شما نزدیک‌ترین‌اند:'
        : 'در کاتالوگ زنده چیزی با این عبارت پیدا نکردم؛ برند، مدل، بودجه یا نوع قطعه را دقیق‌تر بگویید. چیزی از خودم نمی‌سازم.',
    listings: pickListings(rows),
    faqs: topFaqTopics(),
    cta: { label: 'همه‌ی آگهی‌ها', href: '/' },
  });
}
