/**
 * Critical CSS for the frame-1 brand splash (`#ali-initial-splash`).
 *
 * It is inlined in the document head rather than living in globals.css on
 * purpose: the layer has to paint before the stylesheet is parsed, otherwise a
 * cold app launch shows a white screen until React hydrates. Everything here
 * uses literal brand colours with no custom properties for the same reason.
 *
 * Timeline (zero JS, 1.5s total): the lockup lifts and scales in over 620ms
 * while its three emblem paths stagger in, an orange light sweeps across the
 * mark at ~340ms, the layer holds, then fades out and becomes
 * `visibility:hidden` by 1500ms. `html[data-splash-seen]` (set by the
 * pre-paint script) hides it for every later page in the session. It never
 * intercepts touches.
 *
 * The dark block repeats the header lockup's ink swap (cream mark, Habañero
 * SALES): navy on the navy splash would have been invisible.
 */
export const INITIAL_SPLASH_CSS = `
#ali-initial-splash{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:#F4F1EC;pointer-events:none;animation:ali-splash-out 1500ms cubic-bezier(.4,0,.2,1) forwards;will-change:opacity}
html[data-theme='dark'] #ali-initial-splash{background:#111144}
html[data-theme='dark'] #ali-initial-splash .ali-splash-word{color:#FFFFFF}
html[data-theme='dark'] #ali-initial-splash .ali-splash-sales{color:#F98513}
html[data-theme='dark'] #ali-initial-splash svg path:first-of-type{fill:#FFFFFF}
html[data-splash-seen] #ali-initial-splash{display:none}
#ali-initial-splash .ali-splash-mark{position:relative;display:inline-flex;align-items:center;gap:12px;direction:ltr;overflow:hidden;padding:8px 12px;animation:ali-splash-mark 620ms cubic-bezier(.22,1,.36,1) both}
#ali-initial-splash svg{display:block;height:56px;width:auto;overflow:visible}
#ali-initial-splash svg path{animation:ali-splash-path 560ms cubic-bezier(.22,1,.36,1) both}
#ali-initial-splash svg path:nth-child(2){animation-delay:80ms}
#ali-initial-splash svg path:nth-child(3){animation-delay:160ms}
#ali-initial-splash .ali-splash-word{display:inline-flex;align-items:baseline;gap:.18em;font-family:Vazirmatn,Tahoma,system-ui,sans-serif;font-size:22px;font-weight:900;letter-spacing:.12em;white-space:nowrap;color:#223382;animation:ali-splash-word 560ms cubic-bezier(.22,1,.36,1) 180ms both}
#ali-initial-splash .ali-splash-sales{color:#F34405}
#ali-initial-splash .ali-splash-sweep{position:absolute;top:-25%;bottom:-25%;left:0;width:38%;opacity:0;pointer-events:none;background:linear-gradient(100deg,rgba(249,133,19,0) 0%,rgba(249,133,19,.85) 48%,rgba(255,232,199,.95) 62%,rgba(249,133,19,0) 100%);filter:blur(1px);transform:translateX(-160%) skewX(-18deg);animation:ali-splash-sweep 760ms cubic-bezier(.4,0,.2,1) 320ms both}
@keyframes ali-splash-mark{from{opacity:0;transform:scale(.9) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes ali-splash-path{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes ali-splash-word{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes ali-splash-sweep{0%{opacity:0;transform:translateX(-160%) skewX(-18deg)}18%{opacity:1}70%,100%{opacity:0;transform:translateX(360%) skewX(-18deg)}}
@keyframes ali-splash-out{0%,58%{opacity:1}100%{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  #ali-initial-splash .ali-splash-mark,
  #ali-initial-splash .ali-splash-word,
  #ali-initial-splash svg path{animation:none}
  #ali-initial-splash .ali-splash-sweep{display:none}
  #ali-initial-splash{animation:ali-splash-out 900ms linear forwards}
}
`;
