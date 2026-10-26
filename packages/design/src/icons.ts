/**
 * Shared outline-icon registry — one definition, both apps.
 *
 * - Web renders `paths` inline (`<svg stroke="currentColor">`).
 * - Mobile maps them through `react-native-svg` (`SvgPath` per entry).
 *
 * Every icon: 24×24 viewBox, uniform stroke width 1.5, round caps/joins,
 * `currentColor` only — no hex colors may appear in this file (tested).
 * Icons marked `filled` render their path with fill and no stroke (hearts).
 */

export const ICON_VIEWBOX = '0 0 24 24';
export const ICON_STROKE_WIDTH = 1.5;

export interface IconDef {
  readonly paths: readonly string[];
  readonly filled?: boolean;
}

export const ICONS = {
  // Navigation / chrome
  menu: { paths: ['M4 6h16', 'M4 12h16', 'M4 18h16'] },
  close: { paths: ['M6 6l12 12', 'M18 6L6 18'] },
  arrowLeft: { paths: ['M19 12H5', 'M11 18l-6-6 6-6'] },
  chevronDown: { paths: ['M6 9l6 6 6-6'] },
  search: { paths: ['M21 21l-4.3-4.3', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z'] },
  sliders: {
    paths: [
      'M4 21v-7',
      'M4 10V3',
      'M12 21v-9',
      'M12 8V3',
      'M20 21v-5',
      'M20 12V3',
      'M1 14h6',
      'M9 8h6',
      'M17 16h6',
    ],
  },

  // Content / actions
  plus: { paths: ['M12 5v14', 'M5 12h14'] },
  check: { paths: ['M20 6L9 17l-5-5'] },
  send: { paths: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z'] },
  trash: {
    paths: [
      'M3 6h18',
      'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2',
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      'M10 11v6',
      'M14 11v6',
    ],
  },
  heart: {
    paths: [
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z',
    ],
  },
  heartFilled: {
    paths: [
      'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.8 1.1-1.1a5.5 5.5 0 0 0 0-7.8z',
    ],
    filled: true,
  },

  // Photos
  camera: {
    paths: [
      'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
      'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    ],
  },
  cameraPlus: {
    paths: [
      'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z',
      'M12 10v6',
      'M9 13h6',
    ],
  },
  image: {
    paths: [
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M21 15l-5-5L5 21',
      'M8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    ],
  },
  imageX: {
    paths: [
      'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
      'M14 9l6 6',
      'M20 9l-6 6',
    ],
  },

  // Trust / status
  shieldCheck: { paths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'] },
  clock: { paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'] },
  plate: {
    paths: [
      'M2 9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z',
      'M6 12h3',
      'M11 12h2',
      'M15 12h3',
    ],
  },
  sparkle: {
    paths: [
      'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z',
      'M19 16l.6 1.4L21 18l-1.4.6L19 20l-.6-1.4L17 18l1.4-.6z',
    ],
  },
  badgeCheck: {
    paths: [
      'M12 2l2.4 1.8 3-.3 1 2.8 2.6 1.5-.9 2.9.9 2.9-2.6 1.5-1 2.8-3-.3L12 22l-2.4-1.8-3 .3-1-2.8L3 16.2l.9-2.9L3 10.4l2.6-1.5 1-2.8 3 .3z',
      'M8.5 12.2l2.3 2.3 4.7-4.8',
    ],
  },
  car: {
    paths: [
      'M3 15.5V12l1.8-4.6A2 2 0 0 1 6.7 6h10.6a2 2 0 0 1 1.9 1.4L21 12v3.5',
      'M3 15.5h18',
      'M7.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
      'M16.5 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    ],
  },
  alertCircle: {
    paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 8v4', 'M12 16v.01'],
  },

  // Lifecycle states
  pencil: { paths: ['M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z'] },
  hourglass: {
    paths: [
      'M6 2h12',
      'M6 22h12',
      'M7 2v3.5c0 2 2.5 3.2 2.5 5.5S7 14.2 7 16.5V22',
      'M17 2v3.5c0 2-2.5 3.2-2.5 5.5S17 14.2 17 16.5V22',
    ],
  },
  checkCircle: { paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M8 12.5l2.5 2.5 5.5-5.5'] },
  pauseCircle: {
    paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M10 9v6', 'M14 9v6'],
  },
  tag: {
    paths: [
      'M20.6 13.4L12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8z',
      'M7.5 8a0.5 0.5 0 1 0 0-1 0.5 0.5 0 0 0 0 1z',
    ],
  },
  calendarX: {
    paths: [
      'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
      'M8 2v4',
      'M16 2v4',
      'M3 10h18',
      'M14 15l-4 4',
      'M10 15l4 4',
    ],
  },
  xCircle: {
    paths: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M15 9l-6 6', 'M9 9l6 6'],
  },

  // Bottom nav / forms
  home: { paths: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'] },
  message: { paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'] },
  user: {
    paths: [
      'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2',
      'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    ],
  },

  // Theme + view toggles
  sun: {
    paths: [
      'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
      'M12 2v2',
      'M12 20v2',
      'M4.9 4.9l1.4 1.4',
      'M17.7 17.7l1.4 1.4',
      'M2 12h2',
      'M20 12h2',
      'M4.9 19.1l1.4-1.4',
      'M17.7 6.3l1.4-1.4',
    ],
  },
  moon: {
    paths: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  },
  grid: {
    paths: [
      'M4 4h6v6H4z',
      'M14 4h6v6h-6z',
      'M4 14h6v6H4z',
      'M14 14h6v6h-6z',
    ],
  },
  list: { paths: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3.5 6h.01', 'M3.5 12h.01', 'M3.5 18h.01'] },
  phone: {
    paths: [
      'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
    ],
  },

  // Vehicle specs
  mileage: { paths: ['M18 20V10', 'M12 20V4', 'M6 20v-6'] },
  fuel: {
    paths: [
      'M4 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18',
      'M2 22h12',
      'M4 10h8',
      'M14 8h2a2 2 0 0 1 2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V8.5L17 6',
    ],
  },
  gear: {
    paths: [
      'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
      'M12 2v3',
      'M12 19v3',
      'M2 12h3',
      'M19 12h3',
      'M4.9 4.9L7 7',
      'M17 17l2.1 2.1',
      'M19.1 4.9L17 7',
      'M7 17l-2.1 2.1',
    ],
  },
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export function iconFor(name: IconName): IconDef {
  return ICONS[name];
}
