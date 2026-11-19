import { CarLoader } from './CarLoader';

/**
 * Route-level fallback for pages that cannot stream their shell yet.
 *
 * The centered orange tire is the one loading language of the app: every route
 * that used to paint an empty cream column now shows the same mark, so a slow
 * read reads as «the app is working» rather than as a blank page.
 */
export function RouteLoader({
  label,
  size = 'md',
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div
      className="flex min-h-[calc(100dvh-16rem)] items-center justify-center"
      aria-busy="true"
    >
      <CarLoader size={size} label={label} />
    </div>
  );
}
