import { NextResponse } from 'next/server';
import { DEFAULT_FILTERS, fuzzySearchMatch, toAsciiDigits } from '@alisales/schemas';
import { searchListings } from '@/lib/data/listings';
import { topFaqTopics, trackFaq } from '@/lib/data/platform-store';

/**
 * Catalog-aware buying consultant.
 *
 * Three cooperating layers:
 *  1. an advisor that recognises open-ended buying questions and answers with
 *     Kish-market expertise instead of a literal keyword search,
 *  2. a live-catalogue matcher that attaches only real listings,
 *  3. an optional LLM bridge (`OPENAI_API_KEY` / `GEMINI_API_KEY`) that receives
 *     the same compact catalogue context. Without a key every branch still
 *     works, so a client demo can never dead-end.
 *
 * The assistant never invents listings or prices: cards come from
 * `searchListings`, and a missing model is reported as missing rather than
 * replaced with an unrelated car.
 */

interface AssistantListing {
  slug: string;
  title: string;
  priceToman: number;
  city: string;
  coverUrl: string | null;
}

interface AdditionalListing {
  label: string;
  href: string;
}

const PLATE_ANSWER =
  'پلاک منطقه آزاد کیش برای تردد در جزیره است و سند آن با خریدار جابه‌جا می‌شود. گذر موقت برای خودروی وارداتی است که هنوز پلاک دائمی نگرفته و باید در مهلت مجاز تمدید شود. برای خروج خودرو از کیش، وضعیت پلاک، عوارض گمرکی و مهلت گذر موقت را قبل از خرید مکتوب بگیرید.';

const WORKSHOP_ANSWER =
  'کارشناسی تعمیرگاه تخصصی شمس‌اله شامل موتور، گیربکس، بدنه، شاسی و دیاگ تخصصی است و برای کاربران سایت ۲۰٪ تخفیف دارد؛ با صدور برگه ضمانت کارشناسی. برخلاف برچسب «کارشناسی‌شده» روی آگهی‌ها، این بازرسی با حضور خریدار و به‌صورت حضوری انجام می‌شود. از صفحه‌ی کارشناسی یا دکمه‌ی رزرو نوبت، تاریخ و ساعت را انتخاب کنید.';

const BUYING_CHECKLIST =
  'چک‌لیست خرید در کیش: ۱) تطابق شماره شاسی و VIN با سند، ۲) وضعیت شاسی (پلمپ جلو و عقب) و رنگ‌شدگی، ۳) بیمه شخص ثالث و بدنه و باقی‌مانده آن، ۴) معاینه فنی معتبر، ۵) کارکرد واقعی و سرویس‌های نمایندگی، ۶) وضعیت پلاک کیش یا مهلت گذر موقت، ۷) مالیات و عوارض منطقه آزاد. اگر فروشنده برگه کارشناسی دارد، باز هم قبل از پرداخت، کارشناسی حضوری شمس‌اله را بگیرید.';

const INSURANCE_ANSWER =
  'برای خودروی وارداتی، بیمه شخص ثالث اجباری است و بدنه ارزش خودرو را پوشش می‌دهد. باقی‌مانده بیمه را روی برگه ببینید؛ خودرویی که «بیمه دارد» ولی دو ماه تا انقضا دارد، هزینه تمدید را به قیمت اضافه می‌کند. در فیلترها می‌توانید «بیمه شخص ثالث دارد» یا «بیمه بدنه دارد» را انتخاب کنید و در مشخصات تکمیلی آگهی، وضعیت رنگ و شاسی را ببینید.';

const RENTAL_COMING_SOON =
  'پورتال رنت از بازار اصلی جدا شده و به‌زودی روی دامنه‌ی اختصاصی خودش با ناوگان خودرو، اسکوتر برقی و یات راه می‌افتد. تا آن زمان، برای خرید خودرو یا اسکوتر از همین کاتالوگ کمک بگیرید.';

const PROFANITY_REPLY =
  'این لحن به جایی نمی‌رسد، رفیق. من اینجا هستم که کمک کنم ماشین یا یات درست را پیدا کنی، نه اینکه با هم کل‌کل کنیم. بودجه، برند یا نوع کاربری‌ات را بگو تا با هم یه انتخاب تمیز دربیاوریم.';

const PROFANITY_REPLY_EN =
  "That tone won't get us anywhere. I'm here to find you the right car or yacht, not to trade insults. Tell me your budget, brand or use case and we'll pick something sensible.";

/** C1 English counterparts for every deterministic answer. */
const EN = {
  plate:
    'A Kish Free Zone plate is for driving on the island and its registration transfers to the buyer. Temporary entry is for an imported vehicle that does not yet have a permanent plate and must be renewed within the allowed window. Before buying, get the plate status, customs duties and the temporary-entry deadline in writing.',
  workshop:
    'The Shamsollah Specialist Workshop inspection covers the engine, gearbox, body, chassis and a specialist diagnostic, and site members get 20% off with an inspection warranty sheet. Unlike an “inspected” badge on an ad, this inspection is carried out in person with the buyer present. Book a date and time from the inspection page.',
  checklist:
    'Buying checklist for Kish: 1) chassis number and VIN match the documents, 2) chassis condition (front and rear sealed) and any repainting, 3) third-party and body insurance and their remaining term, 4) a valid technical inspection, 5) genuine mileage and dealership service history, 6) Kish plate status or temporary-entry deadline, 7) free-zone taxes and duties. Even if the seller has an inspection sheet, take a Shamsollah in-person inspection before paying.',
  insurance:
    'For an imported car, third-party insurance is mandatory and body insurance covers the vehicle’s value. Check the remaining term on the document; a car that “has insurance” but expires in two months adds the renewal cost to the price. Use the filters for “Third-party insurance” or “Body insurance”, and check the paint and chassis details in the listing’s supplementary specs.',
  rental:
    'The rental portal has moved off the main marketplace and will launch soon on its own domain with cars, electric scooters and yachts. Until then, use this catalogue for buying a car or scooter.',
  compare:
    'The Land Cruiser VXR rides more softly, has wider parts availability and stronger resale value; the Patrol Platinum has a more powerful engine and higher fuel use, with a more comfortable off-road ride. For Kish and coastal roads the Land Cruiser is the lower-hassle choice; for serious off-roading the Patrol on the right tyres is a good pick. Have the chassis and gearbox inspected before buying either.',
  chassis:
    'Paint and chassis are the most important part of an inspection: sealed front and rear means no structural impact; “partial repaint” or “replaced panel” should come with an inspection sheet and a matching price adjustment. ',
  partsFound:
    'These parts are in stock right now; tap a card to see the part number, compatibility and authenticity.',
  partsNone:
    'There is no matching part in the list right now; check the parts category filters or send your request to support.',
  budgetFound: (count: number) =>
    `Within this budget I recommend these ${count} vehicles; all are active and ready to view.`,
  budgetNone:
    'I could not find an active vehicle in that budget; raise it slightly or use the price filter on the vehicles page.',
  hits: 'These are the closest matches to your question:',
  modelMissing:
    'That exact model is not in today’s active stock, and I will not invent one. I have brought the closest real options in the catalogue; tell me your brand, budget range or use case to narrow it further.',
  generic:
    'To guide you precisely, tell me your budget, use case (city, family, off-road or long distance) and plate type. In the meantime, here are the newest active listings in the catalogue.',
  adviceBikeLong: (stock: string) =>
    `For long distances, judge real range rather than advertised range. The NIU NQi GT with a 72 V battery and two swappable packs does roughly 90–100 km of city range in Eco; the Super Soco TC Max is faster and feels better on intercity stretches, but its range drops faster under hard riding. In Kish, a removable battery and charging network matter more than top speed. ${stock} Before buying, get the battery health, charge-cycle count and pack warranty in writing.`,
  adviceBike:
    'To choose a bike, start with the use case: daily city commuting is cheapest on an electric scooter, longer trips need a petrol bike or a long-range model, and off-road needs proper suspension and tyres. We have several active options in the live catalogue; tell me your budget and daily distance and I will compare them precisely.',
  adviceSuv:
    'For family and travel in Kish, an SUV with soft suspension, available parts and sensible fuel use comes first; the Land Cruiser and Patrol are better for serious off-roading, while the X5 and Cayenne drive better on road. Before deciding, inspect the chassis, gearbox and remaining insurance.',
  adviceCheap:
    'On a tight budget, weigh running and parts costs first, not just the purchase price. A car with genuine mileage, valid insurance and a sealed chassis, even a little pricier, is less trouble in the Kish market.',
  adviceDefault:
    'To choose well, tell me three things: approximate budget, use case (city, family, off-road or long distance) and whether you want a Kish plate or temporary entry. With those three I will shortlist the best from the live catalogue.',
} as const;

/** Persian + English profanity/insult gate. */
function isAbusive(text: string): boolean {
  return /(کونی|کسکش|کیر|جنده|حرومزاده|مادرجنده|خفه شو|گه بخور|احمق|ابله|احمقی|کیخدا|fuck|motherfucker|bitch|asshole|idiot|shut up|dumbass|bastard)/i.test(
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

function compactCatalogue(
  rows: Awaited<ReturnType<typeof searchListings>>,
): string {
  return rows
    .filter((listing) => listing.state !== 'sold')
    .slice(0, 28)
    .map((listing) =>
      listing.part
        ? `PART: ${listing.part.title} | ${Math.round(listing.priceIRR / 10).toLocaleString('en-US')} Toman | ${listing.part.condition} | ${listing.part.compatibility ?? ''}`
        : `${listing.brand} ${listing.model} ${listing.trim ?? ''} ${listing.year} | ${listing.category ?? 'car'} | ${listing.mileageKm.toLocaleString('en-US')} km | ${listing.fuel} | ${listing.gearbox} | ${Math.round(listing.priceIRR / 10).toLocaleString('en-US')} Toman`,
    )
    .join('\n');
}

const ADVISOR_SYSTEM = `You are the senior buying consultant for Ali Sales, a Kish Free Zone (Iran) automotive marketplace.
Answer in the language of the buyer's question (Persian by default, fluent C1 English if asked in English).
Be concrete and practical: recommend body types/engine choices, battery range for electric bikes, plate and customs implications in Kish, and what to inspect before purchase.
Use ONLY the live catalogue below for specific stock, prices and availability. If the exact model the buyer names is absent, say so clearly and suggest the closest real in-stock alternatives.
Never invent a listing, price or specification. Keep the answer under 120 words, conversational, and finish with one useful next step.
LIVE CATALOGUE:
`;

async function llmReply(message: string, rows: Awaited<ReturnType<typeof searchListings>>): Promise<string | null> {
  const openai = process.env.OPENAI_API_KEY;
  const gemini = process.env.GEMINI_API_KEY;
  if (!openai && !gemini) return null;

  const context = compactCatalogue(rows);
  const prompt = `${ADVISOR_SYSTEM}${context}\n\nBUYER: ${message}`;

  try {
    if (openai) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${openai}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          temperature: 0.4,
          max_tokens: 260,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = body.choices?.[0]?.message?.content?.trim();
      return text || null;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gemini}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 320 },
        }),
        signal: AbortSignal.timeout(9000),
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    // A slow or unavailable provider falls through to the deterministic expert.
    return null;
  }
}

function adviceMatches(
  active: Awaited<ReturnType<typeof searchListings>>,
  text: string,
): Awaited<ReturnType<typeof searchListings>> {
  const asksBike = /موتور|اسکوتر|bike|scooter|soco|niu/.test(text);
  const asksHeavy = /ماشین.?آلات|کامیون|بیل|لودر|heavy|truck|excavator/.test(text);
  const asksSuv = /شاسی.?بلند|آفرود|خانواده|سفر|suv|crossover/.test(text);
  const asksCheap = /ارزان|اقتصادی|بودجه|کم.?هزینه|cheap|budget/.test(text);

  let pool = active.filter((listing) => listing.state !== 'sold');
  if (asksBike) {
    pool = pool.filter((listing) => listing.category === 'motorcycle');
    // An electric/range question should not answer with a petrol sport bike.
    if (/electric|برقی|باتری|battery|range|برد|مسافت|distance/.test(text)) {
      pool = pool.filter((listing) => listing.fuel === 'electric');
    }
  }
  else if (asksHeavy) pool = pool.filter((listing) => listing.category === 'heavy');
  else pool = pool.filter((listing) => listing.kind !== 'part');

  if (asksSuv) {
    const suv = pool.filter((listing) => listing.bodyType === 'suv');
    if (suv.length > 0) pool = suv;
  }
  if (asksCheap) pool = [...pool].sort((a, b) => a.priceIRR - b.priceIRR);
  return pool.slice(0, 3);
}

function adviceAnswer(
  text: string,
  rows: Awaited<ReturnType<typeof searchListings>>,
  english: boolean,
): string {
  const asksBike = /موتور|اسکوتر|bike|scooter|soco|niu/.test(text);
  const asksLongRange =
    /مسافت|برد|باتری|طولانی|سفر|روزانه|range|battery|distance|commute/.test(text);
  const asksSuv = /شاسی.?بلند|آفرود|خانواده|سفر|suv|crossover/.test(text);
  const asksCheap = /ارزان|اقتصادی|بودجه|کم.?هزینه|cheap|budget/.test(text);

  if (asksBike && asksLongRange) {
    const names = rows
      .map((row) => `${row.model}${row.trim ? ` ${row.trim}` : ''}`)
      .join(english ? ', ' : '، ');
    const stock = english
      ? rows.length > 0
        ? `From today’s live stock, look at the ${names}; all three are ready to view.`
        : 'There is no suitable electric bike in active stock right now; it will appear in this catalogue as soon as one arrives.'
      : rows.length > 0
        ? `از موجودی زنده‌ی امروز، ${names} را ببینید؛ هر سه آماده‌ی بازدید هستند.`
        : 'الان موتور برقی مناسبی در موجودی فعال نیست؛ به‌محض ورود، در همین کاتالوگ نمایش داده می‌شود.';
    if (english) return EN.adviceBikeLong(stock);
    return `برای مسافت بلند، اول برد واقعی و نه برد تبلیغاتی را بسنجید. NIU NQi GT با باتری ۷۲ ولت و دو باتری قابل تعویض، در حالت اکو حدود ۹۰ تا ۱۰۰ کیلومتر برد شهری دارد؛ Super Soco TC Max سریع‌تر است و برای مسیرهای بین‌شهری حس بهتری می‌دهد، اما برد آن با رانندگی پرفشار سریع‌تر افت می‌کند. برای کیش، باتری قابل حمل و شبکه‌ی شارژ مهم‌تر از حداکثر سرعت است. ${stock} قبل از خرید، سلامت باتری، تعداد چرخه‌ی شارژ و گارانتی پک را کتبی بگیرید.`;
  }

  if (asksBike) {
    return english
      ? EN.adviceBike
      : `برای انتخاب موتور، اول کاربری را مشخص کنید: تردد روزانه‌ی شهری با اسکوتر برقی کم‌هزینه‌تر است، مسیرهای طولانی‌تر موتور بنزینی یا مدل بردبالا می‌خواهد و آفرود به تعلیق و لاستیک درست نیاز دارد. در کاتالوگ زنده چند گزینه‌ی فعال داریم؛ بودجه و مسافت روزانه‌تان را بگویید تا دقیق‌تر مقایسه کنم.`;
  }

  if (asksSuv) {
    return english
      ? EN.adviceSuv
      : `برای خانواده و سفر در کیش، شاسی‌بلند با تعلیق نرم، قطعات در دسترس و مصرف معقول اولویت دارد؛ لندکروزر و پاترول برای آفرود جدی‌ترند و X5/Cayenne سواری جاده‌ای بهتری می‌دهند. قبل از تصمیم، کارشناسی شاسی، گیربکس و باقی‌مانده‌ی بیمه را بگیرید.`;
  }

  if (asksCheap) {
    return english
      ? EN.adviceCheap
      : `در بودجه‌ی محدود، اول هزینه‌ی نگهداری و قطعات را بسنجید، نه فقط قیمت خرید. خودرویی با کارکرد واقعی، بیمه‌ی معتبر و شاسی پلمپ، حتی کمی گران‌تر، در بازار کیش کم‌دردس‌تر است.`;
  }

  return english
    ? EN.adviceDefault
    : `برای انتخاب درست، سه چیز را بگویید: بودجه‌ی تقریبی، کاربری (شهری، خانواده، آفرود یا مسافت بلند) و اینکه پلاک کیش می‌خواهید یا گذر موقت. با همین سه مورد، از کاتالوگ زنده دقیق‌ترین گزینه‌ها را جدا می‌کنم.`;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است.' }, { status: 400 });
  }

  const english = (raw as { lang?: unknown })?.lang === 'en';
  const message =
    typeof (raw as { message?: unknown })?.message === 'string'
      ? ((raw as { message: string }).message.trim().slice(0, 300))
      : '';

  if (!message) {
    return NextResponse.json(
      { error: english ? 'Please type your question.' : 'سؤال خود را بنویسید.' },
      { status: 400 },
    );
  }

  const text = toAsciiDigits(message).toLowerCase();

  if (isAbusive(text)) {
    return NextResponse.json({
      reply: /^[\x00-\x7F\s]+$/.test(message) ? PROFANITY_REPLY_EN : PROFANITY_REPLY,
      listings: [],
      faqs: topFaqTopics(),
    });
  }

  // The rental portal now lives on its own domain; never link the old route.
  if (/یات|قایق|مارینا|چارتر|yacht|boat|مارينا|اجاره|رنت|rent/.test(text)) {
    trackFaq('پورتال رنت');
    return NextResponse.json({
      reply: english ? EN.rental : RENTAL_COMING_SOON,
      listings: [],
      faqs: topFaqTopics(),
    });
  }

  // The advisor needs the whole marketplace, not the home page's car+parts
  // default. Fetch each launch category explicitly so a bike question can see
  // the electric bikes and a machinery question can see heavy stock.
  const [mixed, cars, bikes, heavy] = await Promise.all([
    searchListings(DEFAULT_FILTERS),
    searchListings(DEFAULT_FILTERS, 'car'),
    searchListings(DEFAULT_FILTERS, 'motorcycle'),
    searchListings(DEFAULT_FILTERS, 'heavy'),
  ]);
  const seen = new Set<string>();
  const active = [...mixed, ...cars, ...bikes, ...heavy]
    .filter((listing) => {
      if (seen.has(listing.id)) return false;
      seen.add(listing.id);
      return listing.state !== 'sold';
    });

  // Model comparisons a buyer actually asks about.
  if (/لندکروزر|لندکروز|land ?cruiser/.test(text) && /پاترول|patrol/.test(text)) {
    return NextResponse.json({
      reply: english
        ? EN.compare
        : 'لندکروزر VXR سواری نرم‌تر، قطعات فراوان‌تر و ارزش فروش بالاتری دارد؛ پاترول پلاتینیوم موتور قوی‌تر و مصرف بالاتر، با تعلیق راحت‌تر در آفرود. برای کیش و مسیرهای ساحلی، لندکروزر کم‌دردسرتر است؛ اگر آفرود جدی می‌خواهید، پاترول با لاستیک مناسب انتخاب خوبی است. هر دو را قبل از خرید با کارشناسی شاسی و گیربکس چک کنید.',
      listings: [],
      faqs: topFaqTopics(),
      cta: {
        label: english ? 'Compare with brand filter' : 'مقایسه با فیلتر برند',
        href: '/cars?brand=toyota,nissan',
      },
    });
  }

  // Plate / customs rules.
  if (/پلاک|گذر|منطقه آزاد|گمرک|kish plate|transit/.test(text)) {
    trackFaq('فرق پلاک منطقه آزاد و گذر موقت');
    return NextResponse.json({
      reply: english ? EN.plate : PLATE_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: {
        label: english ? 'See free-zone plate vehicles' : 'دیدن خودروهای پلاک منطقه آزاد',
        href: '/cars?plateType=kish',
      },
    });
  }

  // Workshop / inspection.
  if (/کارشناسی|شمس|دیاگ|inspection|برگه/.test(text)) {
    trackFaq('کارشناسی تعمیرگاه شمس‌اله');
    return NextResponse.json({
      reply: english ? EN.workshop : WORKSHOP_ANSWER,
      listings: [],
      faqs: topFaqTopics(),
      cta: {
        label: english ? 'Book an inspection with 20% off' : 'رزرو کارشناسی با ۲۰٪ تخفیف',
        href: '/inspection',
      },
    });
  }

  // Buying checklist / paint / chassis / insurance advice.
  if (/چک.?لیست|چگونه بخرم|راهنمای خرید|شاسی|رنگ|بدنه|بیمه|معاینه فنی|checklist|chassis|insurance/.test(text)) {
    return NextResponse.json({
      reply: /بیمه|insurance/.test(text)
        ? english
          ? EN.insurance
          : INSURANCE_ANSWER
        : /شاسی|رنگ|بدنه|chassis|paint/.test(text)
          ? english
            ? `${EN.chassis}${EN.checklist}`
            : `وضعیت رنگ و شاسی مهم‌ترین بخش بازرسی است: شاسی پلمپ جلو و عقب یعنی بدون ضربه‌ی ساختاری؛ «دوررنگ» یا «تعویض استوک» باید با برگه کارشناسی و اختلاف قیمت همراه باشد. ${BUYING_CHECKLIST}`
          : english
            ? EN.checklist
            : BUYING_CHECKLIST,
      listings: [],
      faqs: topFaqTopics(),
      cta: {
        label: english ? 'Filter sealed-chassis vehicles' : 'فیلتر خودروهای شاسی‌پلمپ',
        href: '/cars?chassisCondition=sealed',
      },
    });
  }

  // Open-ended buying advice: advisor + live stock, never a keyword dead-end.
  const advisoryIntent =
    /بخرم|بگیرم|پیشنهاد|مناسب|بهتره|بهتر است|چه .*(ماشین|موتور|خودرو|شاسی)|recommend|advice|which .*(car|bike|suv)|what should i buy/.test(
      text,
    ) ||
    (/موتور|اسکوتر|bike|scooter/.test(text) &&
      /مسافت|برد|باتری|طولانی|سفر|روزانه|range|battery|distance|commute/.test(text));
  if (advisoryIntent) {
    const rows = adviceMatches(active, text);
    const llm = await llmReply(message, rows.length > 0 ? rows : active);
    trackFaq('مشاوره خرید خودرو');
    return NextResponse.json({
      reply: llm ?? adviceAnswer(text, rows, english),
      listings: pickListings(rows),
      faqs: topFaqTopics(),
      cta: {
        label: /موتور|اسکوتر|bike|scooter/.test(text)
          ? english
            ? 'Browse bikes'
            : 'دیدن موتورها'
          : english
            ? 'Browse cars'
            : 'دیدن خودروها',
        href: /موتور|اسکوتر|bike|scooter/.test(text) ? '/motorcycles' : '/cars',
      },
    });
  }

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
          ? english
            ? EN.partsFound
            : 'این قطعات الان در فهرست قطعات موجودند؛ روی کارت بزنید تا شماره فنی، سازگاری و اصالت را ببینید.'
          : english
            ? EN.partsNone
            : 'فعلاً قطعه‌ی منطبقی در فهرست نیست؛ فیلتر دسته‌بندی قطعات را ببینید یا درخواست خود را به پشتیبانی بدهید.',
      listings: pickListings(rows),
      faqs: topFaqTopics(),
      cta: { label: english ? 'All parts' : 'همه‌ی قطعات', href: '/parts' },
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
          ? english
            ? EN.budgetFound(cars.length)
            : `در این محدوده‌ی بودجه، این ${cars.length} خودرو را پیشنهاد می‌کنم؛ همه فعال و آماده‌ی بازدید هستند.`
          : english
            ? EN.budgetNone
            : 'در این بودجه خودروی فعالی پیدا نکردم؛ بودجه را کمی بالاتر ببرید یا فیلترها را در صفحه‌ی خودروها ببینید.',
      listings: pickListings(cars),
      faqs: topFaqTopics(),
      cta: {
        label: english ? 'Search vehicles by price' : 'جستجوی خودرو با فیلتر قیمت',
        href: '/cars',
      },
    });
  }

  // Live fuzzy search across the whole catalogue. An exact model that is not
  // in stock gets an honest answer; an open question still gets a useful path.
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
  const namedModel = /[a-z]{2,}|لندکروزر|پاترول|پورشه|بی.?ام.?و|مرسدس|تویوتا|نیسان/i.test(
    message,
  );
  trackFaq('جستجوی خودرو در کیش');
  return NextResponse.json({
    reply:
      rows.length > 0
        ? english
          ? EN.hits
          : 'این موارد به سؤال شما نزدیک‌ترین‌اند:'
        : namedModel
          ? english
            ? EN.modelMissing
            : 'این مدل خاص در موجودی فعال امروز نیست و چیزی از خودم نمی‌سازم. نزدیک‌ترین گزینه‌های موجود در کاتالوگ را برایتان آورده‌ام؛ برند، بازه‌ی بودجه یا کاربری را هم بگویید تا دقیق‌تر محدود کنم.'
          : english
            ? EN.generic
            : 'برای اینکه دقیق راهنمایی کنم، بودجه، کاربری (شهری، خانواده، آفرود یا مسافت بلند) و نوع پلاک را بگویید. تا آن موقع، تازه‌ترین آگهی‌های فعال کاتالوگ را ببینید.',
    listings: pickListings(rows.length > 0 ? rows : active.slice(0, 3)),
    faqs: topFaqTopics(),
    cta: { label: english ? 'All listings' : 'همه‌ی آگهی‌ها', href: '/' },
  });
}
