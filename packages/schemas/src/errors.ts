import { z } from 'zod';

/**
 * Strict-Persian validation messages (Zod issue → فارسی).
 *
 * The platform UI is Persian-only, so every validation message surfaced by
 * web forms, mobile forms and edge functions must be Persian. The map is
 * installed automatically when `@alisales/schemas` is imported; apps may call
 * `installPersianErrors()` again after resetting `z.config` in tests.
 */

interface IssueFields {
  code: string;
  minimum?: unknown;
  maximum?: unknown;
  origin?: string;
  format?: string;
  inclusive?: boolean;
}

const ORIGIN_FA: Record<string, string> = {
  string: 'متن',
  number: 'عدد',
  boolean: 'درست/نادرست',
  array: 'فهرست',
  object: 'شناسه',
  date: 'تاریخ',
};

const BOUND_UNIT_FA: Record<string, string> = {
  string: 'نویسه',
  number: '',
  array: 'مورد',
  date: '',
};

function formatBound(value: unknown): string {
  if (typeof value === 'number') return new Intl.NumberFormat('fa-IR').format(value);
  return String(value);
}

export function issueToPersian(rawIssue: { code: string }): string | undefined {
  const issue = rawIssue as IssueFields;

  switch (issue.code) {
    // Custom refinements carry their own Persian message — keep it.
    case 'custom':
      return undefined;

    case 'invalid_type': {
      const expected = ORIGIN_FA[String(issue.origin)] ?? 'نوع معتبر';
      return `نوع مقدار واردشده نادرست است (انتظار: ${expected}).`;
    }

    case 'too_small': {
      const unit = BOUND_UNIT_FA[String(issue.origin)] ?? '';
      const min = formatBound(issue.minimum);
      if (issue.origin === 'string') return `متن باید دست‌کم ${min} ${unit} باشد.`;
      if (issue.origin === 'array') return `حداقل باید ${min} ${unit} انتخاب شود.`;
      return `مقدار نباید کمتر از ${min} باشد.`;
    }

    case 'too_big': {
      const unit = BOUND_UNIT_FA[String(issue.origin)] ?? '';
      const max = formatBound(issue.maximum);
      if (issue.origin === 'string') return `متن نباید بیش از ${max} ${unit} باشد.`;
      if (issue.origin === 'array') return `حداکثر می‌توان ${max} ${unit} انتخاب کرد.`;
      return `مقدار نباید بیش از ${max} باشد.`;
    }

    case 'invalid_format':
      return `قالب واردشده نادرست است${issue.format ? ` (${issue.format})` : ''}.`;

    case 'invalid_value':
    case 'invalid_enum':
      return 'یکی از گزینه‌های مجاز را انتخاب کنید.';

    case 'unrecognized_keys':
      return 'فیلد اضافی شناسایی شد؛ فقط فیلدهای خواسته‌شده را وارد کنید.';

    case 'invalid_union':
      return 'مقدار واردشده با هیچ‌یک از قالب‌های مجاز مطابقت ندارد.';

    case 'invalid_key':
    case 'invalid_element':
    case 'invalid_tuple':
      return 'ساختار داده واردشده نادرست است.';

    default:
      return 'اطلاعات واردشده معتبر نیست.';
  }
}

export function installPersianErrors(): void {
  z.config({ customError: (issue) => issueToPersian(issue as { code: string }) });
}

// Auto-install on import: the whole platform is Persian-only.
installPersianErrors();
