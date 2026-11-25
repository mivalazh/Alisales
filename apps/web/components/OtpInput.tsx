'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';

const LENGTH = 6;

const splitDigits = (value: string): string[] =>
  Array.from({ length: LENGTH }, (_, index) => value[index] ?? '');

/**
 * Six square digit boxes for a one-time code.
 *
 * The value stays a plain string in the parent, so every existing caller keeps
 * its state (`setCode`, fallback `devCode` pre-fill) unchanged.
 *
 * Inside, the digits live in fixed positional slots rather than being read back
 * as `value[i]`: clearing a box in the middle must leave the digits after it
 * where they are, and a joined string would close the gap and slide them left.
 * Every edit is emitted upward as the compacted string, and a value arriving
 * from the parent that this component did not itself emit (the fallback
 * pre-fill, a reset) re-seeds the slots.
 *
 * Behaviour:
 *  · typing a digit advances to the next box;
 *  · Backspace on an empty box clears the previous digit and moves back;
 *  · pasting (or an SMS autofill that drops six characters into one box)
 *    distributes the digits from the first square;
 *  · arrow keys move between boxes.
 *
 * `autoComplete="one-time-code"` sits on the first box only, which is where
 * iOS Safari and Android keyboards offer the code from the incoming message.
 * That first box also allows up to six characters: the OS inserts the whole
 * code into the focused field in one go, and the spread handler above splits
 * it across the boxes. With `maxLength={1}` the platform could deliver only
 * one digit and the suggestion would look broken.
 */
export function OtpInput({
  value,
  onChange,
  id = 'otp',
  label,
  autoFocus = false,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  /** Accessible name of the group, e.g. «کد تأیید». */
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [digits, setDigits] = useState<string[]>(() => splitDigits(value));
  // The last value handed to the parent. Without it the echo of our own change
  // would come back as a "new" compacted value and re-seed the slots, which is
  // exactly the shift this component avoids.
  const emitted = useRef<string | null>(null);

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setDigits(splitDigits(value));
  }, [value]);

  const focusBox = (index: number) => {
    const target = Math.max(0, Math.min(LENGTH - 1, index));
    requestAnimationFrame(() => refs.current[target]?.focus());
  };

  const commit = (next: string[], focusIndex?: number) => {
    const joined = next.join('');
    emitted.current = joined;
    setDigits(next);
    onChange(joined);
    if (focusIndex !== undefined) focusBox(focusIndex);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.replace(/\D/g, '');
    if (!raw) {
      const next = [...digits];
      next[index] = '';
      commit(next);
      return;
    }
    // A code dropped in by the OS keyboard can arrive as six characters in one
    // box; spread it out instead of keeping only the last digit.
    if (raw.length > 1) {
      const next = [...digits];
      for (let offset = 0; offset < raw.length && index + offset < LENGTH; offset += 1) {
        next[index + offset] = raw[offset] ?? '';
      }
      commit(next, index + raw.length);
      return;
    }
    const next = [...digits];
    next[index] = raw;
    commit(next, index + 1);
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!text) return;
    event.preventDefault();
    // A full code always lands from the first square, whichever box was pasted
    // into; a shorter snippet fills from that box onward.
    const next = [...digits];
    if (text.length === LENGTH) {
      for (let i = 0; i < LENGTH; i += 1) next[i] = text[i] ?? '';
    } else {
      for (let offset = 0; offset < text.length && index + offset < LENGTH; offset += 1) {
        next[index + offset] = text[offset] ?? '';
      }
    }
    commit(next, text.length === LENGTH ? LENGTH - 1 : index + text.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      commit(next, index - 1);
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      focusBox(index - 1);
    }
    if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      dir="ltr"
      className="flex items-center justify-center gap-2"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          id={index === 0 ? id : `${id}-${index + 1}`}
          type="text"
          dir="ltr"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={index === 0 ? LENGTH : 1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          name={index === 0 ? 'one-time-code' : `${id}-digit-${index + 1}`}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={index === LENGTH - 1 ? 'done' : 'next'}
          autoFocus={autoFocus && index === 0}
          aria-label={`${label} ${index + 1}`}
          disabled={disabled}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          className={`h-12 w-11 rounded-xl border text-center text-lg font-bold tabular-nums outline-none transition sm:h-13 sm:w-12 ${
            digit
              ? 'border-slate-400/90 bg-[#F4F1EC] text-[#111144] dark:border-white/30 dark:bg-white/5 dark:text-white'
              : 'border-slate-300/90 bg-[#F4F1EC] text-[#111144] dark:border-white/15 dark:bg-white/5 dark:text-white'
          } focus:border-[#F98513] focus:bg-white focus:ring-2 focus:ring-[#F98513]/25 dark:focus:border-[#F98513] dark:focus:bg-[#161A38] disabled:opacity-60`}
        />
      ))}
    </div>
  );
}
