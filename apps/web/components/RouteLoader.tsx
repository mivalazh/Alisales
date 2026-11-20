import { CarLoader } from './CarLoader';

/**
 * Route-level fallback for pages that cannot stream their shell yet.
 *
 * The tire itself is a fixed, viewport-centred overlay, so it contributes no
 * height to the document. Without a placeholder the route's `main` would
 * collapse to the height of the header/footer and pull the bottom navigation
 * and footer up behind the overlay — a visible shift between the skeleton and
 * the loaded page. The invisible block below reserves the same height the page
 * would occupy, so the shell stays put while the wheel spins over it.
 */
export function RouteLoader({
  label,
  size = 'md',
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <>
      <div aria-hidden="true" className="min-h-[calc(100dvh-16rem)]" />
      <CarLoader size={size} label={label} />
    </>
  );
}
