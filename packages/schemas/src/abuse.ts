import { z } from 'zod';
import { abuseReasons, type AbuseReason } from './enums';

/**
 * «گزارش آگهی» — one report per (listing, reporter), same rule as the
 * `abuse_reports` unique key. Details stay under the DB's 1000-char check.
 */
export const ABUSE_REASON_LABELS: Record<AbuseReason, string> = {
  fraud: 'کلاهبرداری یا قیمت غیرواقعی',
  wrong_info: 'اطلاعات نادرست آگهی',
  inappropriate: 'محتوای نامناسب',
  copyright: 'نقض حق نشر یا عکس غیرمجاز',
  spam: 'آگهی تکراری یا تبلیغاتی',
  other: 'موارد دیگر',
};

export const abuseReportSchema = z.object({
  // Hosted ids are UUIDs; the credential-less dev store uses `local-…` ids, so
  // the shape check stays permissive and the route's listing lookup decides.
  listingId: z.string().trim().min(1, { message: 'شناسه آگهی معتبر نیست.' }).max(128),
  reason: z.enum(abuseReasons, { message: 'دلیل گزارش را انتخاب کنید.' }),
  details: z.string().trim().max(1000).optional(),
});

export type AbuseReportInput = z.infer<typeof abuseReportSchema>;

/** Agent threshold in `0002_functions.sql` — reports at/over it hide a listing. */
export const ABUSE_HIDE_THRESHOLD = 3;
