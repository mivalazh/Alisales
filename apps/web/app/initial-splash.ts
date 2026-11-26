/**
 * Critical CSS for the frame-1 brand splash (`#ali-initial-splash`).
 *
 * It is inlined in the document head rather than living in globals.css on
 * purpose: the layer has to paint before the stylesheet is parsed, otherwise a
 * cold app launch shows a white screen until React hydrates. Everything here
 * uses literal brand colours with no custom properties for the same reason.
 *
 * Only phones get the splash: it is `display:none` by default and only turns on
 * under `max-width: 767px`, so desktop and every wide browser tab paint the
 * page immediately. iOS PWA cold boots are covered separately by the warm
 * `apple-touch-startup-image` in the document head, so the icon tap never shows
 * a white web view before this layer exists.
 *
 * Timeline (zero JS, 1.5s total, then the layer is gone for the session):
 *   0ms     the emblem springs in (subtle scale + lift, no bounce-back)
 *   70ms    its three strokes arrive in order
 *   230ms   the wordmark letters land one by one, 62ms apart, with a springy
 *           overshoot so the lockup feels playful rather than mechanical
 *   430ms   an orange light sweeps across the finished lockup
 *   1110ms  the whole layer fades out while scaling up a hair, so the exit
 *           reads as a reveal of the page underneath
 *
 * `html[data-splash-seen]` (set by the pre-paint script) hides it for every
 * later page in the session. It never intercepts touches, so the page beneath
 * is usable from the first frame. `prefers-reduced-motion` keeps the brand
 * paint but drops every movement and shortens the fade.
 *
 * The dark block repeats the header lockup's ink swap (cream emblem, Habañero
 * SALES) and uses the brand navy as its canvas.
 */
export const INITIAL_SPLASH_CSS = `
/* Paint the document itself before any stylesheet arrives. On iOS the web
   view is white until the document has a background, which is exactly the
   blank flash a cold PWA launch shows. */
html,body{background:#F4F1EC}
html[data-theme='dark'],html[data-theme='dark'] body{background:#111144}
/* Off everywhere until a phone viewport opts in below. */
#ali-initial-splash{display:none}
@media (max-width:767px){
  #ali-initial-splash{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:#F4F1EC;pointer-events:none;will-change:opacity,transform;animation:ali-splash-out 1500ms cubic-bezier(.4,0,.2,1) forwards}
  html[data-theme='dark'] #ali-initial-splash{background:#111144}
}
/* Desktop and tablets never see it, even in an installed app window. */
@media (min-width:768px){
  #ali-initial-splash{display:none!important}
}
html[data-theme='dark'] #ali-initial-splash .ali-splash-letter{color:#FFFFFF}
html[data-theme='dark'] #ali-initial-splash .ali-splash-letter--sales{color:#F98513}
html[data-theme='dark'] #ali-initial-splash svg path:first-of-type{fill:#FFFFFF}
html[data-splash-seen] #ali-initial-splash{display:none!important}
/* Emblem on top, wordmark directly below it. */
#ali-initial-splash .ali-splash-mark{position:relative;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;direction:ltr;overflow:hidden;padding:10px 16px;animation:ali-splash-mark 620ms cubic-bezier(.34,1.55,.64,1) both}
#ali-initial-splash svg{display:block;height:56px;width:auto;overflow:visible}
#ali-initial-splash svg path{transform-origin:50% 60%;animation:ali-splash-path 520ms cubic-bezier(.34,1.5,.64,1) both}
#ali-initial-splash svg path:nth-child(2){animation-delay:70ms}
#ali-initial-splash svg path:nth-child(3){animation-delay:140ms}
#ali-initial-splash .ali-splash-word{display:inline-flex;align-items:baseline;font-family:Vazirmatn,Tahoma,system-ui,sans-serif;font-size:22px;font-weight:900;letter-spacing:.14em;white-space:nowrap}
#ali-initial-splash .ali-splash-letter{display:inline-block;color:#111144;opacity:0;transform-origin:50% 100%;animation:ali-splash-letter 560ms cubic-bezier(.34,1.56,.64,1) both}
#ali-initial-splash .ali-splash-letter--sales{color:#F98513}
#ali-initial-splash .ali-splash-space{display:inline-block;width:.34em}
/* 55ms stagger over ALI then SALES, starting as the emblem settles. */
#ali-initial-splash .ali-splash-letter:nth-child(1){animation-delay:230ms}
#ali-initial-splash .ali-splash-letter:nth-child(2){animation-delay:285ms}
#ali-initial-splash .ali-splash-letter:nth-child(3){animation-delay:340ms}
#ali-initial-splash .ali-splash-letter:nth-child(5){animation-delay:395ms}
#ali-initial-splash .ali-splash-letter:nth-child(6){animation-delay:450ms}
#ali-initial-splash .ali-splash-letter:nth-child(7){animation-delay:505ms}
#ali-initial-splash .ali-splash-letter:nth-child(8){animation-delay:560ms}
#ali-initial-splash .ali-splash-letter:nth-child(9){animation-delay:615ms}
#ali-initial-splash .ali-splash-sweep{position:absolute;top:-25%;bottom:-25%;left:0;width:38%;opacity:0;pointer-events:none;background:linear-gradient(100deg,rgba(249,133,19,0) 0%,rgba(249,133,19,.85) 48%,rgba(255,232,199,.95) 62%,rgba(249,133,19,0) 100%);filter:blur(1px);transform:translateX(-160%) skewX(-18deg);animation:ali-splash-sweep 760ms cubic-bezier(.4,0,.2,1) 430ms both}
@keyframes ali-splash-mark{0%{opacity:0;transform:scale(.9) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}
@keyframes ali-splash-path{0%{opacity:0;transform:translateY(10px) scale(.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes ali-splash-letter{0%{opacity:0;transform:translateY(14px) scale(.8) rotate(-6deg)}100%{opacity:1;transform:translateY(0) scale(1) rotate(0)}}
@keyframes ali-splash-sweep{0%{opacity:0;transform:translateX(-160%) skewX(-18deg)}18%{opacity:1}70%,100%{opacity:0;transform:translateX(360%) skewX(-18deg)}}
/* Hold the finished lockup for a beat, then reveal the page under it. */
@keyframes ali-splash-out{0%,74%{opacity:1;transform:scale(1);visibility:visible}100%{opacity:0;transform:scale(1.04);visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  #ali-initial-splash .ali-splash-mark,
  #ali-initial-splash .ali-splash-letter,
  #ali-initial-splash svg path{animation:none;opacity:1;transform:none}
  #ali-initial-splash .ali-splash-sweep{display:none}
  #ali-initial-splash{animation:ali-splash-out 700ms linear forwards}
}
`;
