'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { YearGridSelect } from './YearGridSelect';

const DELIVERY_OPTIONS = ['تحویل در فرودگاه', 'تحویل در هتل', 'تحویل در محل'] as const;

/**
 * «ثبت آگهی اجاره» form for the rental portal.
 *
 * Rates are typed in Toman with live comma grouping; the API stores IRR. The
 * delivery options and minimum age are the questions a renter actually asks
 * before booking, so they are part of the post rather than the description.
 */
export function RentForm() {
  const router = useRouter();
  const [kind, setKind] = useState<'car' | 'scooter'>('car');
  const [form, setForm] = useState({
    title: '',
    brand: '',
    model: '',
    year: '',
    agency: '',
    dailyToman: '',
    weeklyToman: '',
    monthlyToman: '',
    depositNote: '',
    minAge: '23',
  });
  const [delivery, setDelivery] = useState<string[]>([DELIVERY_OPTIONS[0], DELIVERY_OPTIONS[1]]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const group = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    return digits ? Number(digits).toLocaleString('en-US') : '';
  };

  const toggleDelivery = (option: string) =>
    setDelivery((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option],
    );

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rentals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, kind, delivery }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(body.error ?? 'ثبت آگهی انجام نشد.');
        return;
      }
      router.push('/rent');
    } catch {
      setError('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#064E3B]/15 bg-white p-4 dark:border-white/10 dark:bg-[#12211c]">
      <div>
        <span className="mb-1 block text-[11px] font-extrabold text-[#064E3B]/70 dark:text-white/60">
          نوع ناوگان
        </span>
        <div className="flex gap-1.5">
          {(
            [
              { key: 'car', label: 'خودرو' },
              { key: 'scooter', label: 'اسکوتر / موتور برقی' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={kind === option.key}
              onClick={() => setKind(option.key)}
              className={`rounded-[var(--radius-pill)] border px-4 py-2 text-xs font-extrabold transition ${
                kind === option.key
                  ? 'border-[#064E3B] bg-[#064E3B] text-white'
                  : 'border-[#064E3B]/20 text-[#064E3B] dark:border-white/20 dark:text-white/70'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <input
        className="field"
        placeholder="عنوان آگهی — مثلاً رنج روور ووگ ۲۰۲۲ با راننده"
        value={form.title}
        onChange={(event) => set('title', event.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="field"
          placeholder="برند (Land Rover)"
          value={form.brand}
          onChange={(event) => set('brand', event.target.value)}
        />
        <input
          className="field"
          placeholder="مدل (Range Rover Vogue)"
          value={form.model}
          onChange={(event) => set('model', event.target.value)}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <YearGridSelect value={form.year} onChange={(next) => set('year', next)} ariaLabel="سال ساخت" />
        <input
          className="field"
          placeholder="آژانس / نمایشگاه"
          value={form.agency}
          onChange={(event) => set('agency', event.target.value)}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(
          [
            { key: 'dailyToman', label: 'نرخ روزانه (تومان)' },
            { key: 'weeklyToman', label: 'نرخ هفتگی' },
            { key: 'monthlyToman', label: 'نرخ ماهانه' },
          ] as const
        ).map((rate) => (
          <label key={rate.key} className="block">
            <span className="mb-1 block text-[11px] font-extrabold text-[#064E3B]/70 dark:text-white/60">
              {rate.label}
            </span>
            <input
              className="field"
              inputMode="numeric"
              dir="ltr"
              value={form[rate.key]}
              onChange={(event) => set(rate.key, group(event.target.value))}
              placeholder="0"
            />
          </label>
        ))}
      </div>

      <textarea
        className="field min-h-20"
        placeholder="شرایط ودیعه — مثلاً ودیعه ۱۰۰ میلیون تومان یا چک صیادی"
        value={form.depositNote}
        onChange={(event) => set('depositNote', event.target.value)}
      />

      <div>
        <span className="mb-1 block text-[11px] font-extrabold text-[#064E3B]/70 dark:text-white/60">
          تحویل
        </span>
        <div className="flex flex-wrap gap-1.5">
          {DELIVERY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={delivery.includes(option)}
              onClick={() => toggleDelivery(option)}
              className={`rounded-[var(--radius-pill)] border px-3 py-1.5 text-[11px] font-bold transition ${
                delivery.includes(option)
                  ? 'border-[#D97706] bg-[#FEF3C7] text-[#92400E]'
                  : 'border-[#064E3B]/20 text-[#064E3B]/70 dark:border-white/20 dark:text-white/60'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-extrabold text-[#064E3B]/70 dark:text-white/60">
          حداقل سن راننده
        </span>
        <input
          className="field"
          inputMode="numeric"
          dir="ltr"
          value={form.minAge}
          onChange={(event) => set('minAge', event.target.value)}
        />
      </label>

      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy}
        className="w-full rounded-[var(--radius-pill)] bg-[#D97706] px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-[#b45309] disabled:opacity-60"
      >
        {busy ? 'در حال ثبت…' : 'انتشار آگهی اجاره'}
      </button>
    </div>
  );
}
