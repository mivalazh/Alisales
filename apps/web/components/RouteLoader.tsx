import { CarLoader } from './CarLoader';

/**
 * Route-level fallback for pages that cannot stream their shell yet.
 *
 * The tire is the app's one loading language. `CarLoader` paints itself as a
 * fixed, viewport-centred overlay, so a slow route reads as «the app is
 * working» over the shell instead of a blank cream column — and it can never
 * collide with the stories rail or a card.
 */
export function RouteLoader({
  label,
  size = 'md',
}: {
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return <CarLoader size={size} label={label} />;
}
