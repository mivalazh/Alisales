/**
 * Critical CSS for the frame-1 brand splash (`#ali-initial-splash`).
 *
 * It is inlined in the document head rather than living in globals.css on
 * purpose: the layer has to paint before the stylesheet is parsed, otherwise a
 * cold app launch shows a white screen until React hydrates. Everything here
 * uses literal brand colours with no custom properties for the same reason.
 *
 * Timeline (zero JS): the mark reveals with a staggered path lift + scale in
 * ~420ms, the layer holds, then fades out and becomes `visibility:hidden` by
 * 800ms. `html[data-splash-seen]` (set by the pre-paint script) hides it for
 * every later page in the session. It never intercepts touches.
 *
 * The dark block repeats the header lockup's ink swap (cream mark, Habañero
 * SALES): navy on the navy splash would have been invisible.
 */
export const INITIAL_SPLASH_CSS = `
#ali-initial-splash{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;background:#F4F1EC;pointer-events:none;animation:ali-splash-out 800ms cubic-bezier(.4,0,.2,1) forwards}
html[data-theme='dark'] #ali-initial-splash{background:#111144}
html[data-theme='dark'] #ali-initial-splash .ali-splash-word{color:#FFFFFF}
html[data-theme='dark'] #ali-initial-splash .ali-splash-sales{color:#F98513}
html[data-theme='dark'] #ali-initial-splash svg path:first-of-type{fill:#FFFFFF}
html[data-splash-seen] #ali-initial-splash{display:none}
#ali-initial-splash .ali-splash-mark{display:inline-flex;align-items:center;gap:12px;direction:ltr;animation:ali-splash-mark 420ms cubic-bezier(.22,1,.36,1) both}
#ali-initial-splash svg{display:block;height:56px;width:auto;overflow:visible}
#ali-initial-splash svg path{animation:ali-splash-path 500ms cubic-bezier(.22,1,.36,1) both}
#ali-initial-splash svg path:nth-child(2){animation-delay:70ms}
#ali-initial-splash svg path:nth-child(3){animation-delay:140ms}
#ali-initial-splash .ali-splash-word{display:inline-flex;align-items:baseline;gap:.18em;font-family:Vazirmatn,Tahoma,system-ui,sans-serif;font-size:22px;font-weight:900;letter-spacing:.12em;white-space:nowrap;color:#223382}
#ali-initial-splash .ali-splash-sales{color:#F34405}
@keyframes ali-splash-mark{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes ali-splash-path{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
@keyframes ali-splash-out{0%,56%{opacity:1}100%{opacity:0;visibility:hidden}}
@media (prefers-reduced-motion:reduce){
  #ali-initial-splash .ali-splash-mark,
  #ali-initial-splash svg path{animation:none}
  #ali-initial-splash{animation:ali-splash-out 800ms linear forwards}
}
`;
