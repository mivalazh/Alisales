import {
  ICONS,
  ICON_STROKE_WIDTH,
  ICON_VIEWBOX,
  type IconDef,
  type IconName,
} from '@studio/design';

/** Web renderer for the shared icon registry (currentColor, 24×24, 1.5 stroke). */
export function Icon({
  name,
  size = 20,
  className,
  filled,
}: {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  const def: IconDef = ICONS[name];
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={ICON_VIEWBOX}
      fill="none"
      stroke={filled || def.filled ? 'none' : 'currentColor'}
      strokeWidth={filled || def.filled ? 0 : ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {def.paths.map((d) => (
        <path key={d} d={d} fill={filled || def.filled ? 'currentColor' : 'none'} />
      ))}
    </svg>
  );
}
