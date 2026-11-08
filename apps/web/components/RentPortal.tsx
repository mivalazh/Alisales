'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { RentalPosting } from '@/lib/data/platform-store';

type Lang = 'fa' | 'en' | 'ar' | 'zh';
type Kind = 'all' | 'car' | 'scooter' | 'yacht';

interface CopyShape {
  dir: 'rtl' | 'ltr';
  brand: string;
  title: string;
  subtitle: string;
  add: string;
  back: string;
  categories: Record<Kind, string>;
  filterTitle: string;
  category: string;
  from: string;
  to: string;
  capacity: string;
  delivery: string;
  insurance: string;
  any: string;
  capacityOptions: readonly string[];
  deliveryOptions: readonly string[];
  insuranceOptions: readonly string[];
  results: string;
  perDay: string;
  perWeek: string;
  perMonth: string;
  reserve: string;
  seats: string;
  captain: string;
  marina: string;
  automatic: string;
  ac: string;
  insuranceIncluded: string;
  calcTitle: string;
  days: string;
  plan: string;
  planFull: string;
  planBasic: string;
  total: string;
  deposit: string;
  confirm: string;
  confirmed: string;
  name: string;
  phone: string;
  close: string;
  empty: string;
  note: string;
}

const COPY: Record<Lang, CopyShape> = {
  fa: {
    dir: 'rtl',
    brand: 'Ali Sales Rent',
    title: 'رنت خودرو، اسکوتر و یات در کیش',
    subtitle:
      'ناوگان لوکس، اسکوترهای برقی و قایق‌های تفریحی کیش با نرخ شفاف، تحویل در فرودگاه، هتل یا مارینا و بیمه‌ی مشخص.',
    add: 'ثبت آگهی اجاره',
    back: 'خرید و فروش',
    categories: { all: 'همه', car: 'خودروهای لوکس و کروک', scooter: 'موتور و اسکوتر برقی', yacht: 'یات و قایق تفریحی' },
    filterTitle: 'بازه‌ی اجاره و تحویل را انتخاب کنید',
    category: 'دسته‌بندی و مدل',
    from: 'از تاریخ',
    to: 'تا تاریخ',
    capacity: 'ظرفیت نفرات',
    delivery: 'محل تحویل',
    insurance: 'طرح بیمه و ودیعه',
    any: 'همه',
    capacityOptions: ['هر ظرفیتی', '۲ نفره', '۴ نفره', '۵+ نفره', '۱۰+ نفره برای یات'],
    deliveryOptions: ['هر محلی', 'فرودگاه کیش', 'لابی هتل', 'اسکله تفریحی / مارینا کیش', 'دفتر رنت'],
    insuranceOptions: ['همه طرح‌ها', 'بیمه کامل', 'بدون چک', 'ودیعه نقدی'],
    results: 'گزینه موجود',
    perDay: 'روزانه',
    perWeek: 'هفتگی',
    perMonth: 'ماهانه',
    reserve: 'رزرو و محاسبه قیمت',
    seats: 'نفر',
    captain: 'کاپیتان همراه',
    marina: 'مارینا کیش',
    automatic: 'اتوماتیک',
    ac: 'کولر',
    insuranceIncluded: 'بیمه بدنه',
    calcTitle: 'رزرو آنلاین و محاسبه هزینه',
    days: 'مدت اجاره (روز)',
    plan: 'طرح بیمه',
    planFull: 'بیمه کامل (+۱۲٪)',
    planBasic: 'بیمه پایه',
    total: 'مبلغ نهایی',
    deposit: 'ودیعه',
    confirm: 'ثبت درخواست رزرو',
    confirmed: 'درخواست رزرو ثبت شد؛ آژانس برای تأیید تماس می‌گیرد.',
    name: 'نام و نام خانوادگی',
    phone: 'شماره تماس',
    close: 'بستن',
    empty: 'برای این فیلتر گزینه‌ای نیست؛ بازه یا دسته را تغییر دهید.',
    note: 'آژانس یا قایق دارید؟ ناوگان خود را رایگان در پورتال رنت ثبت کنید.',
  },
  en: {
    dir: 'ltr',
    brand: 'Ali Sales Rent',
    title: 'Rent cars, scooters & yachts in Kish',
    subtitle:
      'Kish luxury cars, electric scooters and charter yachts with clear rates, airport, hotel or marina delivery and defined insurance.',
    add: 'List your fleet',
    back: 'Buy & sell',
    categories: { all: 'All', car: 'Luxury & convertible cars', scooter: 'Bikes & electric scooters', yacht: 'Yachts & boats' },
    filterTitle: 'Choose your rental window and delivery',
    category: 'Category & model',
    from: 'From date',
    to: 'To date',
    capacity: 'Passengers',
    delivery: 'Delivery point',
    insurance: 'Insurance & deposit',
    any: 'Any',
    capacityOptions: ['Any capacity', '2 seats', '4 seats', '5+ seats', '10+ seats (yacht)'],
    deliveryOptions: ['Anywhere', 'Kish Airport', 'Hotel lobby', 'Kish Marina', 'Rental office'],
    insuranceOptions: ['All plans', 'Full insurance', 'No cheque', 'Cash deposit'],
    results: 'available',
    perDay: 'Daily',
    perWeek: 'Weekly',
    perMonth: 'Monthly',
    reserve: 'Reserve & calculate',
    seats: 'seats',
    captain: 'Captain included',
    marina: 'Kish Marina',
    automatic: 'Automatic',
    ac: 'A/C',
    insuranceIncluded: 'Insurance',
    calcTitle: 'Online reservation & price calculator',
    days: 'Rental days',
    plan: 'Insurance plan',
    planFull: 'Full insurance (+12%)',
    planBasic: 'Basic insurance',
    total: 'Total',
    deposit: 'Deposit',
    confirm: 'Request reservation',
    confirmed: 'Reservation request received; the agency will call to confirm.',
    name: 'Full name',
    phone: 'Phone number',
    close: 'Close',
    empty: 'No results for this filter; change the dates or category.',
    note: 'Own a fleet? List your cars, scooters or yachts free on the rental portal.',
  },
  ar: {
    dir: 'rtl',
    brand: 'Ali Sales Rent',
    title: 'استئجار السيارات والدراجات واليخوت في كيش',
    subtitle:
      'سيارات فاخرة ودراجات كهربائية ويخوت للإيجار في كيش بأسعار واضحة، توصيل في المطار أو الفندق أو المارينا وتأمين محدد.',
    add: 'أضف أسطولك',
    back: 'بيع وشراء',
    categories: { all: 'الكل', car: 'سيارات فاخرة ومكشوفة', scooter: 'دراجات ودراجات كهربائية', yacht: 'يخوت وقوارب' },
    filterTitle: 'اختر فترة الإيجار ومكان التسليم',
    category: 'الفئة والطراز',
    from: 'من تاريخ',
    to: 'إلى تاريخ',
    capacity: 'عدد الركاب',
    delivery: 'مكان التسليم',
    insurance: 'التأمين والوديعة',
    any: 'الكل',
    capacityOptions: ['أي سعة', 'مقعدان', '٤ مقاعد', '٥+ مقاعد', '١٠+ لليخت'],
    deliveryOptions: ['أي مكان', 'مطار كيش', 'بهو الفندق', 'مارينا كيش', 'مكتب التأجير'],
    insuranceOptions: ['كل الخطط', 'تأمين شامل', 'بدون شيك', 'وديعة نقدية'],
    results: 'متاح',
    perDay: 'يومي',
    perWeek: 'أسبوعي',
    perMonth: 'شهري',
    reserve: 'احجز واحسب السعر',
    seats: 'ركاب',
    captain: 'القبطان مشمول',
    marina: 'مارينا كيش',
    automatic: 'أوتوماتيك',
    ac: 'تكييف',
    insuranceIncluded: 'تأمين',
    calcTitle: 'حجز إلكتروني وحاسبة السعر',
    days: 'عدد الأيام',
    plan: 'خطة التأمين',
    planFull: 'تأمين شامل (+١٢٪)',
    planBasic: 'تأمين أساسي',
    total: 'الإجمالي',
    deposit: 'الوديعة',
    confirm: 'إرسال طلب الحجز',
    confirmed: 'تم استلام طلب الحجز؛ ستتصل الوكالة للتأكيد.',
    name: 'الاسم الكامل',
    phone: 'رقم الهاتف',
    close: 'إغلاق',
    empty: 'لا نتائج لهذا الفلتر؛ غيّر التواريخ أو الفئة.',
    note: 'لديك أسطول؟ أضف سياراتك أو يخوتك مجاناً في بوابة الإيجار.',
  },
  zh: {
    dir: 'ltr',
    brand: 'Ali Sales Rent',
    title: '基什岛租车、电动踏板车与游艇',
    subtitle: '基什豪华车队、电动踏板车与包船游艇，价格透明，机场、酒店或码头交车，保险方案清晰。',
    add: '发布车队',
    back: '买卖平台',
    categories: { all: '全部', car: '豪华与敞篷车', scooter: '摩托与电动踏板车', yacht: '游艇与船只' },
    filterTitle: '选择租期与交车地点',
    category: '类别与车型',
    from: '开始日期',
    to: '结束日期',
    capacity: '乘客人数',
    delivery: '交车地点',
    insurance: '保险与押金',
    any: '全部',
    capacityOptions: ['不限人数', '2 座', '4 座', '5+ 座', '10+ 座（游艇）'],
    deliveryOptions: ['任意地点', '基什机场', '酒店大堂', '基什码头', '租车办公室'],
    insuranceOptions: ['全部方案', '全险', '免支票', '现金押金'],
    results: '个可选',
    perDay: '日租',
    perWeek: '周租',
    perMonth: '月租',
    reserve: '预订并计算价格',
    seats: '座',
    captain: '含船长',
    marina: '基什码头',
    automatic: '自动挡',
    ac: '空调',
    insuranceIncluded: '保险',
    calcTitle: '在线预订与价格计算',
    days: '租期（天）',
    plan: '保险方案',
    planFull: '全险（+12%）',
    planBasic: '基本保险',
    total: '总价',
    deposit: '押金',
    confirm: '提交预订请求',
    confirmed: '预订请求已收到，租车公司会致电确认。',
    name: '姓名',
    phone: '联系电话',
    close: '关闭',
    empty: '此筛选没有结果，请更换日期或类别。',
    note: '拥有车队？在租赁门户免费发布车辆、踏板车或游艇。',
  },
};

const LANGS: ReadonlyArray<{ key: Lang; label: string }> = [
  { key: 'fa', label: 'FA' },
  { key: 'en', label: 'EN' },
  { key: 'ar', label: 'AR' },
  { key: 'zh', label: 'ZH' },
];

function toman(irr: number): string {
  return `${Math.round(irr / 10).toLocaleString('en-US')} T`;
}

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 1;
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
}

function capacityOf(rental: RentalPosting): number {
  if (rental.capacity) return rental.capacity;
  return rental.kind === 'scooter' ? 2 : 5;
}

/**
 * Turo-inspired rental portal.
 *
 * Four languages, three fleets (cars / electric scooters / yachts) and one
 * booking calculator. Rates are stored in IRR; the UI prints Toman. The hero
 * card is the filter table: category, dates, passengers, delivery point and
 * insurance plan all narrow the fleet before a card is opened.
 */
export function RentPortal({ rentals }: { rentals: RentalPosting[] }) {
  const [lang, setLang] = useState<Lang>('fa');
  const copy = COPY[lang];
  const [kind, setKind] = useState<Kind>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [capacity, setCapacity] = useState(0);
  const [delivery, setDelivery] = useState('');
  const [insurance, setInsurance] = useState('');
  const [active, setActive] = useState<RentalPosting | null>(null);

  const filtered = useMemo(() => {
    return rentals.filter((rental) => {
      if (kind !== 'all' && rental.kind !== kind) return false;
      if (capacity > 0 && capacityOf(rental) < capacity) return false;
      if (delivery && !rental.delivery.includes(delivery)) return false;
      if (insurance && !rental.depositNote.includes(insurance)) return false;
      return true;
    });
  }, [rentals, kind, capacity, delivery, insurance]);

  const days = daysBetween(from, to);

  return (
    <div
      dir={copy.dir}
      className="-mx-4 -mt-6 bg-[#F4F1EC] pb-12 sm:-mx-6 lg:-my-8 dark:bg-[#111144]"
    >
      <section className="relative overflow-hidden bg-[#111144] px-4 py-7 text-white sm:px-6 sm:py-9">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#DEF434]/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#DEF434]">
              {copy.brand}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-full border border-white/20 bg-white/10 p-0.5">
                {LANGS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setLang(item.key)}
                    aria-pressed={lang === item.key}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition ${
                      lang === item.key
                        ? 'bg-[#DEF434] text-[#111144]'
                        : 'text-white/75 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Link
                href="/"
                className="rounded-full border border-white/25 px-3 py-1.5 text-[11px] font-extrabold text-white transition hover:bg-white/10"
              >
                {copy.back}
              </Link>
            </div>
          </div>

          <h1 className="mt-4 max-w-2xl text-2xl font-extrabold leading-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.subtitle}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/rent/new"
              className="inline-flex items-center gap-2 rounded-full bg-[#DEF434] px-4 py-2.5 text-sm font-extrabold text-[#111144] transition hover:bg-[#e9fa6a]"
            >
              <Icon name="plus" size={17} />
              {copy.add}
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2.5 text-xs font-bold text-white/85">
              <Icon name="pin" size={14} /> Kish Marina · Kish Airport
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Hero booking filter table (IMG_2415 / Turo style). */}
        <section className="-mt-7 rounded-3xl border border-[#0F7FC4]/15 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#1b1b4f] sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-extrabold text-[#111144] dark:text-white">
            <Icon name="sliders" size={15} className="text-[#0F7FC4]" />
            {copy.filterTitle}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.category}
              </span>
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as Kind)}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                <option value="all">{copy.categories.all}</option>
                <option value="car">{copy.categories.car}</option>
                <option value="scooter">{copy.categories.scooter}</option>
                <option value="yacht">{copy.categories.yacht}</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.from}
              </span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.to}
              </span>
              <input
                type="date"
                value={to}
                min={from}
                onChange={(event) => setTo(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.capacity}
              </span>
              <select
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                {copy.capacityOptions.map((option, index) => (
                  <option key={option} value={[0, 2, 4, 5, 10][index] ?? 0}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.delivery}
              </span>
              <select
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                {copy.deliveryOptions.map((option, index) => (
                  <option key={option} value={index === 0 ? '' : option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2 lg:col-span-2">
              <span className="mb-1 block text-[10px] font-extrabold text-slate-500 dark:text-white/60">
                {copy.insurance}
              </span>
              <select
                value={insurance}
                onChange={(event) => setInsurance(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#F4F1EC] px-3 py-2 text-xs font-bold text-[#111144] dark:border-white/15 dark:bg-white/10 dark:text-white"
              >
                {copy.insuranceOptions.map((option, index) => (
                  <option key={option} value={index === 0 ? '' : ['', 'بیمه کامل', 'چک', 'ودیعه نقدی'][index] ?? ''}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <p className="w-full rounded-xl bg-[#0F7FC4]/10 px-3 py-2 text-xs font-extrabold text-[#0F7FC4]">
                {filtered.length} {copy.results} · {days} {copy.days}
              </p>
            </div>
          </div>
        </section>

        <nav aria-label={copy.category} className="mt-5 flex flex-wrap gap-2">
          {(Object.keys(copy.categories) as Kind[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              aria-pressed={kind === key}
              className={`rounded-full border px-4 py-2 text-xs font-extrabold transition ${
                kind === key
                  ? 'border-[#0F7FC4] bg-[#0F7FC4] text-white'
                  : 'border-[#111144]/15 bg-white text-[#111144] hover:border-[#0F7FC4]/50 dark:border-white/15 dark:bg-white/5 dark:text-white/80'
              }`}
            >
              {copy.categories[key]}
            </button>
          ))}
        </nav>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rental) => (
            <li
              key={rental.slug}
              className="overflow-hidden rounded-2xl border border-[#111144]/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:border-white/10 dark:bg-[#1b1b4f]"
            >
              <div className="relative aspect-[16/10] bg-[#e8e3d8]">
                <Image
                  src={rental.imageUrl}
                  alt={rental.title}
                  fill
                  unoptimized={rental.imageUrl.endsWith('.svg')}
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover"
                />
                <span className="absolute top-2 start-2 rounded-full bg-[#DEF434] px-2.5 py-1 text-[10px] font-extrabold text-[#111144]">
                  {copy.categories[rental.kind]}
                </span>
                {rental.captainIncluded && (
                  <span className="absolute bottom-2 start-2 rounded-full bg-[#111144]/85 px-2 py-0.5 text-[10px] font-bold text-white">
                    ⚓ {copy.captain}
                  </span>
                )}
              </div>

              <div className="space-y-2 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#0F7FC4]">
                  {rental.brand}
                </p>
                <h2 className="line-clamp-2 text-sm font-extrabold leading-6 text-[#111144] dark:text-white">
                  {rental.title}
                </h2>
                <p className="flex items-center gap-1 text-[11px] font-bold text-[#111144]/60 dark:text-white/60">
                  <Icon name="pin" size={12} />
                  {rental.kind === 'yacht' ? copy.marina : rental.agency}
                  {rental.lengthFt ? ` · ${rental.lengthFt} ft` : ''}
                </p>

                <ul className="flex flex-wrap gap-1">
                  {[
                    rental.kind === 'yacht'
                      ? `⚓ ${copy.captain}`
                      : rental.kind === 'scooter'
                        ? `⚡ ${copy.automatic}`
                        : `❄ ${copy.ac} · ${copy.automatic}`,
                    `👥 ${capacityOf(rental)} ${copy.seats}`,
                    `🛡 ${copy.insuranceIncluded}`,
                  ].map((spec) => (
                    <li
                      key={spec}
                      className="rounded-full bg-[#F4F1EC] px-2 py-0.5 text-[10px] font-bold text-[#111144]/75 dark:bg-white/10 dark:text-white/70"
                    >
                      {spec}
                    </li>
                  ))}
                </ul>

                <div className="grid grid-cols-3 gap-1.5 border-y border-[#111144]/10 py-2 text-center dark:border-white/10">
                  {[
                    { label: copy.perDay, value: rental.dailyIRR },
                    { label: copy.perWeek, value: rental.weeklyIRR },
                    { label: copy.perMonth, value: rental.monthlyIRR },
                  ].map((rate) => (
                    <div key={rate.label}>
                      <p className="text-[9px] font-bold text-[#111144]/50 dark:text-white/50">
                        {rate.label}
                      </p>
                      <p className="mt-0.5 text-[10px] font-extrabold tabular-nums text-[#D97706]">
                        {toman(rate.value)}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setActive(rental)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#0F7FC4] px-3 py-2 text-xs font-extrabold text-white transition hover:bg-[#0c6aa5]"
                >
                  {copy.reserve}
                  <Icon name="chevronLeft" size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 && (
          <p className="mt-6 rounded-2xl border border-dashed border-[#0F7FC4]/30 bg-white/60 px-4 py-6 text-center text-sm font-bold text-[#0F7FC4] dark:bg-white/5">
            {copy.empty}
          </p>
        )}

        <p className="mt-6 rounded-2xl border border-dashed border-[#111144]/20 bg-white/60 px-4 py-3 text-center text-xs font-bold leading-6 text-[#111144]/65 dark:border-white/15 dark:bg-white/5 dark:text-white/60">
          {copy.note}
        </p>
      </div>

      {active && (
        <BookingModal
          rental={active}
          copy={copy}
          from={from}
          to={to}
          initialDays={days}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function BookingModal({
  rental,
  copy,
  from,
  to,
  initialDays,
  onClose,
}: {
  rental: RentalPosting;
  copy: CopyShape;
  from: string;
  to: string;
  initialDays: number;
  onClose: () => void;
}) {
  const [days, setDays] = useState(initialDays);
  const [plan, setPlan] = useState<'basic' | 'full'>('basic');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = rental.dailyIRR * Math.max(1, days);
  const total = plan === 'full' ? Math.round(base * 1.12) : base;

  async function submit(): Promise<void> {
    if (busy || !name.trim() || !phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rentals/book', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          rentalSlug: rental.slug,
          rentalTitle: rental.title,
          name,
          phone,
          from,
          to,
          days,
          plan,
          totalIRR: total,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'ثبت رزرو انجام نشد.');
        return;
      }
      setDone(true);
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy.calcTitle}
        dir={copy.dir}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-card p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#0F7FC4]">
              {rental.agency}
            </p>
            <h2 className="mt-1 text-base font-extrabold text-ink">{rental.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {done ? (
          <div className="mt-5 rounded-2xl border border-[#0F7FC4]/25 bg-[#0F7FC4]/10 p-4 text-center">
            <p className="text-sm font-extrabold text-[#0F7FC4]">{copy.confirmed}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 rounded-full bg-[#0F7FC4] px-4 py-2 text-xs font-extrabold text-white"
            >
              {copy.close}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-extrabold text-faint">{copy.days}</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={days}
                  onChange={(event) => setDays(Math.max(1, Number(event.target.value) || 1))}
                  className="field h-9 text-xs"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-extrabold text-faint">{copy.plan}</span>
                <select
                  value={plan}
                  onChange={(event) => setPlan(event.target.value as 'basic' | 'full')}
                  className="field h-9 text-xs"
                >
                  <option value="basic">{copy.planBasic}</option>
                  <option value="full">{copy.planFull}</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-extrabold text-faint">{copy.name}</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="field h-9 text-xs"
                  placeholder="—"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-extrabold text-faint">{copy.phone}</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="field h-9 text-xs"
                  inputMode="tel"
                  placeholder="09…"
                  dir="ltr"
                />
              </label>
            </div>

            <dl className="mt-4 space-y-1.5 rounded-2xl bg-page p-3 text-xs">
              <div className="flex justify-between">
                <dt className="font-bold text-muted">
                  {copy.perDay} × {days}
                </dt>
                <dd className="font-extrabold text-ink" dir="ltr">
                  {toman(base)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-1.5">
                <dt className="font-extrabold text-ink">{copy.total}</dt>
                <dd className="font-extrabold text-[#D97706]" dir="ltr">
                  {toman(total)}
                </dd>
              </div>
              <div className="flex justify-between text-[10px] text-muted">
                <dt>{copy.deposit}</dt>
                <dd className="text-start">{rental.depositNote}</dd>
              </div>
            </dl>

            {error && (
              <p role="alert" className="mt-2 text-xs font-bold text-red-600">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !name.trim() || !phone.trim()}
              className="mt-4 w-full rounded-full bg-[#D97706] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#b45309] disabled:opacity-50"
            >
              {busy ? '…' : copy.confirm}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
