import Link from 'next/link';
import { Icon, type IconName } from './Icon';

/**
 * One empty state for the account lists. Chats and saved listings had drifted
 * into two different frames; this is the single calm card both screens render,
 * so an empty inbox and an empty saved list read as the same product.
 */
export function ListEmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: IconName;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 bg-white p-10 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F4F1EC] text-[#111144] dark:bg-white/[0.06] dark:text-[#F4F1EC]">
        <Icon name={icon} size={26} />
      </span>
      <p className="mt-4 text-base font-extrabold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-muted">{description}</p>
      <Link
        href={actionHref}
        className="mt-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] bg-[#111144] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1b1b57] active:scale-[0.98] dark:bg-[#F98513] dark:text-[#111144] dark:hover:bg-[#ffa13d]"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
