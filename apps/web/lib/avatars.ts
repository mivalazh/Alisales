/**
 * Curated vector avatars for members who do not want to upload a photo.
 * Every avatar is an inline SVG data URL, so it needs no bucket, no upload and
 * no remote image permission.
 */

function avatarSvg(from: string, to: string, glyph: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="96" height="96" fill="url(#g)"/>
    <circle cx="20" cy="18" r="12" fill="#fff" opacity=".16"/>
    <circle cx="82" cy="26" r="7" fill="#fff" opacity=".12"/>
    <path d="M0 72 Q24 64 48 72 T96 72 V96 H0Z" fill="#111144" opacity=".26"/>
    ${glyph}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const stroke = 'fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';

export const CURATED_AVATARS = [
  {
    id: 'coupe',
    label: 'راننده کوپه اسپرت',
    labelEn: 'Sports coupe driver',
    url: avatarSvg(
      '#F98513',
      '#111144',
      `<path d="M18 63h60l-6-12c-3-7-9-10-18-10H44c-8 0-14 4-18 10l-8 12Z" ${stroke}/>
       <circle cx="32" cy="64" r="8" ${stroke}/><circle cx="66" cy="64" r="8" ${stroke}/>
       <circle cx="32" cy="64" r="2.2" fill="#F98513"/><circle cx="66" cy="64" r="2.2" fill="#F98513"/>`,
    ),
  },
  {
    id: 'suv',
    label: 'ماجراجوی شاسی‌بلند',
    labelEn: 'Off-road SUV adventurer',
    url: avatarSvg(
      '#0F7FC4',
      '#111144',
      `<path d="M20 62V48c0-4 3-7 7-7h42c4 0 7 3 7 7v14" ${stroke}/>
       <path d="M24 48h48M36 41v7M58 41v7" ${stroke}/>
       <circle cx="33" cy="63" r="8" ${stroke}/><circle cx="65" cy="63" r="8" ${stroke}/>
       <path d="M12 68h10M75 68h10" ${stroke} opacity=".65"/>`,
    ),
  },
  {
    id: 'scooter',
    label: 'سوار اسکوتر برقی',
    labelEn: 'Electric scooter rider',
    url: avatarSvg(
      '#57C7A3',
      '#123A58',
      `<circle cx="28" cy="65" r="9" ${stroke}/><circle cx="68" cy="65" r="9" ${stroke}/>
       <path d="M28 65h18l9-20h10M53 45h10l7 20h8" ${stroke}/>
       <path d="M48 45h12" ${stroke}/>`,
    ),
  },
  {
    id: 'yacht',
    label: 'کاپیتان یات لوکس',
    labelEn: 'Luxury yacht captain',
    url: avatarSvg(
      '#223382',
      '#0F7FC4',
      `<path d="M18 62h60l-8 12H26l-8-12Z" ${stroke}/>
       <path d="M48 26v36M48 30l22 26H48" ${stroke}/>
       <path d="M12 80c8-4 14-4 22 0s14 4 22 0 14-4 22 0" ${stroke} opacity=".7"/>`,
    ),
  },
  {
    id: 'mechanic',
    label: 'مکانیک کلاسیک',
    labelEn: 'Classic mechanic',
    url: avatarSvg(
      '#5B6478',
      '#111144',
      `<path d="M62 24a14 14 0 0 0-17 18L24 63a7 7 0 1 0 10 10l21-21a14 14 0 0 0 18-17l-10 10-9-2-2-9 10-10Z" ${stroke}/>`,
    ),
  },
  {
    id: 'racer',
    label: 'راننده سایبرپانک',
    labelEn: 'Cyberpunk racer',
    url: avatarSvg(
      '#C026D3',
      '#111144',
      `<path d="M25 57c0-16 9-27 23-27s23 11 23 27v7H25v-7Z" ${stroke}/>
       <path d="M31 55h34l-4 10H35l-4-10Z" fill="#F98513"/>
       <path d="M29 64h38" ${stroke}/>`,
    ),
  },
  {
    id: 'classic',
    label: 'عاشق خودرو کلاسیک',
    labelEn: 'Classic car lover',
    url: avatarSvg(
      '#B45309',
      '#111144',
      `<path d="M18 62h60l-5-10c-4-8-10-11-20-11H45c-9 0-15 4-19 11l-8 10Z" ${stroke}/>
       <path d="M38 41v10M60 41v10" ${stroke}/>
       <circle cx="32" cy="64" r="8" ${stroke}/><circle cx="66" cy="64" r="8" ${stroke}/>`,
    ),
  },
  {
    id: 'island',
    label: 'ساکن جزیره کیش',
    labelEn: 'Kish islander',
    url: avatarSvg(
      '#F98513',
      '#0A6E6E',
      `<path d="M48 76V44" ${stroke}/>
       <path d="M48 48c-10-12-20-10-25-7 9 2 14 6 18 13M48 52c10-12 20-10 25-7-9 2-14 6-18 13M48 44c-4-10-10-13-16-14 5 7 7 12 7 18" ${stroke}/>
       <path d="M18 76h60" ${stroke}/>`,
    ),
  },
] as const;
