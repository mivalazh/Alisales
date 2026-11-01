// One-off generator for the demo cover set (kept in the repo for repeatability).
// Run: node scripts/gen-covers.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = 'apps/web/public/covers';
mkdirSync(OUT, { recursive: true });

const THEMES = {
  'land-cruiser': {
    sky: ['#0a2334', '#1a5a6b'],
    sun: '#ffcf7a',
    body: ['#ffffff', '#e8eff5', '#a9b8c6'],
    glass: ['#315a72', '#0a1a25'],
    label: 'Toyota Land Cruiser VXR',
  },
  patrol: {
    sky: ['#1b1018', '#5b2531'],
    sun: '#ff9d6b',
    body: ['#3b4450', '#212832', '#0c1117'],
    glass: ['#5b8ba3', '#12232e'],
    label: 'Nissan Patrol Platinum',
  },
  's-class': {
    sky: ['#101726', '#33415f'],
    sun: '#cfe3ff',
    body: ['#f4f7fa', '#c9d3dc', '#8494a2'],
    glass: ['#31506a', '#0a141d'],
    label: 'Mercedes-Benz S-Class S 500',
  },
  x5: {
    sky: ['#08182a', '#164661'],
    sun: '#9ad9ff',
    body: ['#ffffff', '#e9eff5', '#a3b4c4'],
    glass: ['#2a5878', '#08161f'],
    label: 'BMW X5 xDrive40i',
  },
  cayenne: {
    sky: ['#171130', '#3d2350'],
    sun: '#f0b7ff',
    body: ['#3a3f4a', '#20242c', '#0b0d12'],
    glass: ['#6a86a8', '#101a26'],
    label: 'Porsche Cayenne',
  },
};

/** Body + glass geometry per silhouette, all in the same 1200×900 frame. */
const SHAPES = {
  'land-cruiser': {
    body: 'M150 660V540q0-18 22-22l98-10 60-152q8-14 30-14h460q22 0 32 16l46 154 126 12q20 4 20 22v114z',
    glass: ['M352 500l16-128h152v128z', 'M540 372h120v128H540z', 'M682 372h124l46 128H682z'],
    trim: { rails: [[360, 334, 170, 9], [560, 334, 250, 9]], door: 560, handles: [[572, 540], [700, 540]] },
    wheels: [332, 898],
    wheelY: 690,
    wheelR: 78,
  },
  patrol: {
    body: 'M142 664V534q0-18 22-22l104-10 56-158q8-16 32-16h470q24 0 34 18l44 158 122 10q20 4 20 22v128z',
    glass: ['M348 496l18-134h156v134z', 'M540 362h128v134H540z', 'M688 362h122l48 134H688z'],
    trim: { rails: [[356, 324, 176, 9], [560, 324, 250, 9]], door: 566, handles: [[578, 532], [706, 532]] },
    wheels: [330, 902],
    wheelY: 694,
    wheelR: 80,
  },
  's-class': {
    body: 'M126 662V614q0-20 24-24l150-18c58-56 112-90 200-90h150c94 0 150 34 204 90l170 18q26 4 26 26v46z',
    glass: ['M382 560c48-40 92-60 158-60h92v60z', 'M662 500h112c66 0 114 20 150 60H662z'],
    trim: { rails: [], door: 642, handles: [[654, 574], [758, 574]] },
    wheels: [326, 896],
    wheelY: 690,
    wheelR: 72,
  },
  x5: {
    body: 'M140 660V552q0-18 22-22l106-10 64-138q10-18 36-18h392q26 0 40 18l50 138 132 12q22 4 22 24v104z',
    glass: ['M392 512l24-118h168v118z', 'M600 394h150l46 118H600z'],
    trim: { rails: [[400, 384, 320, 9]], door: 596, handles: [[608, 524], [716, 524]] },
    wheels: [334, 894],
    wheelY: 690,
    wheelR: 78,
  },
  cayenne: {
    body: 'M132 660V602q0-22 26-26l128-16c62-50 118-76 200-76h132c88 0 148 28 202 78l168 16q24 4 24 26v56z',
    glass: ['M400 574c54-38 104-58 172-58h72v58z', 'M672 516h140c70 0 120 22 154 58H672z'],
    trim: { rails: [], door: 660, handles: [[672, 584], [772, 584]] },
    wheels: [330, 898],
    wheelY: 690,
    wheelR: 74,
  },
};

function svg(key) {
  const t = THEMES[key];
  const s = SHAPES[key];
  const glass = s.glass.map((d) => `<path d="${d}" fill="url(#glass)"/>`).join('\n  ');
  const handles = s.trim.handles
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="40" height="9" rx="4" fill="#93a2b0" opacity="0.85"/>`)
    .join('\n  ');
  const arches = s.wheels
    .map((x) => `<circle cx="${x}" cy="${s.wheelY}" r="${s.wheelR + 16}" fill="#000"/>`)
    .join('');
  const wheels = s.wheels
    .map(
      (x) => `<g>
    <circle cx="${x}" cy="${s.wheelY}" r="${s.wheelR + 8}" fill="#080c11"/>
    <circle cx="${x}" cy="${s.wheelY}" r="${s.wheelR}" fill="#141b23"/>
    <circle cx="${x}" cy="${s.wheelY}" r="${Math.round(s.wheelR * 0.58)}" fill="#b9c6d2"/>
    <circle cx="${x}" cy="${s.wheelY}" r="${Math.round(s.wheelR * 0.24)}" fill="#7f8c99"/>
  </g>`,
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="${t.label}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.sky[0]}"/>
      <stop offset="1" stop-color="${t.sky[1]}"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${t.sun}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${t.sun}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.body[0]}"/>
      <stop offset="0.55" stop-color="${t.body[1]}"/>
      <stop offset="1" stop-color="${t.body[2]}"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${t.glass[0]}"/>
      <stop offset="1" stop-color="${t.glass[1]}"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1c26"/>
      <stop offset="1" stop-color="#050c12"/>
    </linearGradient>
    <mask id="arch">
      <rect width="1200" height="900" fill="#fff"/>
      ${arches}
    </mask>
  </defs>

  <rect width="1200" height="900" fill="url(#sky)"/>
  <circle cx="912" cy="248" r="240" fill="url(#sun)"/>
  <rect y="748" width="1200" height="152" fill="url(#ground)"/>
  <ellipse cx="600" cy="768" rx="452" ry="22" fill="#030a10" opacity="0.6"/>

  ${wheels}

  <g mask="url(#arch)">
    <path d="${s.body}" fill="url(#body)"/>
    ${glass}
    <path d="M152 ${s.wheelY - 118}h892" stroke="#77848f" stroke-width="4" opacity="0.4"/>
    ${handles}
    <rect x="${s.trim.door}" y="${s.wheelY - 96}" width="4" height="80" fill="#78858f" opacity="0.45"/>
    <rect x="978" y="${s.wheelY - 76}" width="56" height="22" rx="10" fill="#ffe2a6"/>
    <rect x="158" y="${s.wheelY - 76}" width="38" height="18" rx="8" fill="#b3372d"/>
  </g>
</svg>
`;
}

for (const key of Object.keys(SHAPES)) {
  writeFileSync(`${OUT}/${key}.svg`, svg(key), 'utf8');
  console.log('wrote', `${OUT}/${key}.svg`);
}
