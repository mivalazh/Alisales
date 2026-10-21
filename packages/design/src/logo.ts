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

export const LOGO = { primary, dark, symbol } as const;

/** Full standalone SVG document for a variant (e.g. writing a static asset). */
export function logoSvgDocument(variant: LogoVariant, title = 'Alisales'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${variant.viewBox}" width="${variant.width}" height="${variant.height}" role="img" aria-label="${title}"><title>${title}</title>${variant.markup}</svg>`;
}
