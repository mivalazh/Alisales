/**
 * Alisales brand marks (SVG).
 *
 * - `primary`  — horizontal lockup for light headers/navigation
 * - `dark`     — same lockup optimized for dark backgrounds
 * - `symbol`   — rounded 'A' tile for app icons / favicons
 *
 * Raw markup strings keep @studio/design framework-free; web renders them via
 * `dangerouslySetInnerHTML` (or copies `logo/*.svg` into `public/`), React
 * Native maps them through `react-native-svg` in the mobile app.
 */
export interface LogoVariant {
  viewBox: string;
  width: number;
  height: number;
  markup: string;
}

const primary: LogoVariant = {
  viewBox: '0 0 196 40',
  width: 196,
  height: 40,
  markup: `<g fill="none" stroke="#161224" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 31 L19 9 L29.5 31"/></g><path d="M13.4 22.5 H24.6" fill="none" stroke="#FF4000" stroke-width="4.5" stroke-linecap="round"/><text x="42" y="27.5" font-family="Vazirmatn, Tahoma, 'Segoe UI', sans-serif" font-size="21" font-weight="700" fill="#161224" letter-spacing="-0.2">Alisales</text>`,
};

const dark: LogoVariant = {
  viewBox: '0 0 196 40',
  width: 196,
  height: 40,
  markup: `<g fill="none" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 31 L19 9 L29.5 31"/></g><path d="M13.4 22.5 H24.6" fill="none" stroke="#FF4000" stroke-width="4.5" stroke-linecap="round"/><text x="42" y="27.5" font-family="Vazirmatn, Tahoma, 'Segoe UI', sans-serif" font-size="21" font-weight="700" fill="#FFFFFF" letter-spacing="-0.2">Alisales</text>`,
};

const symbol: LogoVariant = {
  viewBox: '0 0 512 512',
  width: 512,
  height: 512,
  markup: `<rect width="512" height="512" rx="112" fill="#161224"/><g fill="none" stroke="#FFFFFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"><path d="M136 372 L256 128 L376 372"/></g><path d="M188 284 H324" fill="none" stroke="#FF4000" stroke-width="46" stroke-linecap="round"/>`,
};

/**
 * App monogram — the single tile mark used in the web header center.
 *
 * Colors come from CSS variables so one markup serves both themes:
 *   --logo-bg  #F98513 (same in light and dark)
 *   --logo-fg  #111144 light · #F4F1EC dark
 * The fallbacks keep the markup usable outside the web theme (mobile, docs).
 */
const monogram: LogoVariant = {
  viewBox: '0 0 64 64',
  width: 64,
  height: 64,
  markup: `<rect width="64" height="64" rx="18" fill="var(--logo-bg, #F98513)"/><g fill="none" stroke="var(--logo-fg, #111144)" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 46 L32 18 L46 46"/><path d="M24.5 36 H39.5"/></g>`,
};

/**
 * Full «A ALI SALES» lockup — angular A with the two sweeping road arcs and the
 * heavy geometric wordmark. Geometry is fixed; only the inks change with theme,
 * through CSS variables so one markup serves both modes:
 *   --logo-navy    #16235A light · #F4F1EC dark  (A pillar, «ALI»)
 *   --logo-accent  #F98513 both modes            (upper arc, «SALES»)
 */
const lockup: LogoVariant = {
  viewBox: '0 0 460 180',
  width: 460,
  height: 180,
  markup:
    `<g fill="none" stroke="var(--logo-navy, #16235A)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"><path d="M44 148 L98 36 L152 148"/></g>` +
    `<path d="M70 112 H126" fill="none" stroke="var(--logo-navy, #16235A)" stroke-width="17" stroke-linecap="round"/>` +
    `<path d="M24 118 C64 78 132 78 172 118" fill="none" stroke="var(--logo-accent, #F98513)" stroke-width="15" stroke-linecap="round"/>` +
    `<path d="M32 158 C84 176 132 176 176 152" fill="none" stroke="var(--logo-navy, #16235A)" stroke-width="11" stroke-linecap="round"/>` +
    `<g fill="none" stroke="var(--logo-navy, #16235A)" stroke-width="10" stroke-linecap="butt" stroke-linejoin="miter">` +
    `<path d="M206 62 L226 22 L246 62"/>` +
    `<path d="M213 48 H239"/>` +
    `<path d="M262 22 V62 H294"/>` +
    `<path d="M310 22 V62"/>` +
    `</g>` +
    `<g fill="none" stroke="var(--logo-accent, #F98513)" stroke-width="10" stroke-linecap="butt" stroke-linejoin="miter">` +
    `<path d="M242 102 H212 V124 H242 V146 H212"/>` +
    `<path d="M264 146 L284 102 L304 146"/>` +
    `<path d="M270 132 H298"/>` +
    `<path d="M320 102 V146 H352"/>` +
    `<path d="M368 102 V146 M368 102 H398 M368 124 H390 M368 146 H398"/>` +
    `<path d="M444 102 H414 V124 H444 V146 H414"/>` +
    `</g>`,
};

export const LOGO = { primary, dark, symbol } as const;

/** Full horizontal «A ALI SALES» lockup (CSS-variable inks). */
export const LOCKUP = lockup as LogoVariant;

/** Standalone monogram variant (CSS-variable colors, no wordmark). */
export const MONOGRAM = monogram;

/** Full standalone SVG document for a variant (e.g. writing a static asset). */
export function logoSvgDocument(variant: LogoVariant, title = 'Alisales'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${variant.viewBox}" width="${variant.width}" height="${variant.height}" role="img" aria-label="${title}"><title>${title}</title>${variant.markup}</svg>`;
}
