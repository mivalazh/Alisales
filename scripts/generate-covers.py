#!/usr/bin/env python3
"""
Studio render generator for the catalog covers.

The catalogue ships local SVG art so a credential-less preview never shows a
broken image. Flat single-tone vectors read as placeholders, so this script
draws layered studio renders instead: a graded backdrop with a soft spotlight,
sculpted paint with crease highlights, reflective glass, LED headlamps, a front
fascia with grille slats, multi-spoke alloys over brake discs, and a floor
reflection.

Run: python3 scripts/generate-covers.py
Outputs: apps/web/public/covers/*.svg (artifacts/covers/*.png are previews).
"""

from __future__ import annotations

import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "apps/web/public/covers"
PREVIEW = ROOT / "artifacts/covers"


def backdrop(uid: str, c: dict) -> str:
    return f"""  <defs>
    <linearGradient id="wall-{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{c['wall_top']}"/>
      <stop offset="1" stop-color="{c['wall_bottom']}"/>
    </linearGradient>
    <linearGradient id="floor-{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{c['floor_top']}"/>
      <stop offset="1" stop-color="{c['floor_bottom']}"/>
    </linearGradient>
    <radialGradient id="halo-{uid}" cx="0.5" cy="0.38" r="0.66">
      <stop offset="0" stop-color="{c['halo']}" stop-opacity="0.9"/>
      <stop offset="0.5" stop-color="{c['halo']}" stop-opacity="0.18"/>
      <stop offset="1" stop-color="{c['halo']}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beam-{uid}" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="0.42" stop-color="#ffffff" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="contact-{uid}" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000000" stop-opacity="0.6"/>
      <stop offset="0.62" stop-color="#000000" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="refl-fade-{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <mask id="refl-mask-{uid}">
      <rect x="0" y="700" width="1200" height="200" fill="url(#refl-fade-{uid})"/>
    </mask>
  </defs>
  <rect width="1200" height="900" fill="url(#wall-{uid})"/>
  <ellipse cx="600" cy="330" rx="640" ry="420" fill="url(#halo-{uid})"/>
  <rect y="700" width="1200" height="200" fill="url(#floor-{uid})"/>
  <path d="M0,700 H1200" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>
  <rect width="1200" height="900" fill="url(#beam-{uid})"/>
"""


def paint_defs(uid: str, c: dict) -> str:
    return f"""    <linearGradient id="paint-{uid}" x1="0.05" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="{c['paint']}"/>
      <stop offset="0.22" stop-color="{c['paint2']}"/>
      <stop offset="0.42" stop-color="{c['paint']}"/>
      <stop offset="0.66" stop-color="{c['shade']}"/>
      <stop offset="0.86" stop-color="{c['paint2']}"/>
      <stop offset="1" stop-color="{c['shade']}"/>
    </linearGradient>
    <linearGradient id="glass-{uid}" x1="0.1" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#eaf2ff" stop-opacity="0.95"/>
      <stop offset="0.34" stop-color="#93a7bf" stop-opacity="0.9"/>
      <stop offset="0.72" stop-color="#2c3647" stop-opacity="0.94"/>
      <stop offset="1" stop-color="#141a25" stop-opacity="0.97"/>
    </linearGradient>
    <linearGradient id="chrome-{uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.42" stop-color="#c9ced7"/>
      <stop offset="0.56" stop-color="#7d8592"/>
      <stop offset="1" stop-color="#eaeef4"/>
    </linearGradient>
    <linearGradient id="grille-{uid}" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0" stop-color="#0a0c11"/>
      <stop offset="0.5" stop-color="#20242c"/>
      <stop offset="1" stop-color="#0a0c11"/>
    </linearGradient>
    <radialGradient id="lamp-{uid}" cx="0.34" cy="0.32" r="0.8">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.3" stop-color="#e2edff"/>
      <stop offset="0.66" stop-color="#7d9cc8"/>
      <stop offset="1" stop-color="#151d2b"/>
    </radialGradient>
    <radialGradient id="lens-{uid}" cx="0.4" cy="0.34" r="0.7">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#b8d2f2"/>
      <stop offset="1" stop-color="#2b3a52"/>
    </radialGradient>
    <radialGradient id="tyre-{uid}" cx="0.4" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#3f434b"/>
      <stop offset="0.55" stop-color="#202329"/>
      <stop offset="1" stop-color="#07080b"/>
    </radialGradient>
    <linearGradient id="rim-{uid}" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#f7f9fc"/>
      <stop offset="0.3" stop-color="#c6ccd6"/>
      <stop offset="0.55" stop-color="#6c7481"/>
      <stop offset="0.78" stop-color="#b3bac5"/>
      <stop offset="1" stop-color="#e6ebf1"/>
    </linearGradient>
"""


def wheel(uid: str, cx: float, cy: float, r: float, spokes: int = 10) -> str:
    rim = r * 0.66
    out = [
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#tyre-{uid})"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#04050a" stroke-width="3"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r * 0.955:.1f}" fill="none" stroke="#6e747d" stroke-opacity="0.4" stroke-width="2"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{r * 0.8:.1f}" fill="none" stroke="#0a0b0f" stroke-opacity="0.9" stroke-width="{r * 0.07:.1f}"/>',
        # brake disc + hat behind the spokes
        f'<circle cx="{cx}" cy="{cy}" r="{rim * 0.92:.1f}" fill="#3f4550"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{rim * 0.88:.1f}" fill="none" stroke="#8d94a0" stroke-opacity="0.5" stroke-width="2"/>',
    ]
    for i in range(20):
        a = math.radians(i * 18)
        out.append(
            f'<circle cx="{cx + math.cos(a) * rim * 0.74:.1f}" cy="{cy + math.sin(a) * rim * 0.74:.1f}" '
            f'r="{max(1.5, r * 0.014):.1f}" fill="#191d24"/>'
        )
    # caliper peeking through the spokes at the rear of the wheel
    out.append(
        f'<path d="M {cx - rim * 0.92:.1f},{cy + rim * 0.1:.1f} a {rim * 0.92:.1f},{rim * 0.92:.1f} 0 0 0 '
        f'{rim * 0.5:.1f},{rim * 0.72:.1f} l {rim * 0.1:.1f},{-rim * 0.12:.1f} '
        f'a {rim * 0.8:.1f},{rim * 0.8:.1f} 0 0 1 {-rim * 0.44:.1f},{-rim * 0.62:.1f} Z" fill="#b3261e"/>'
    )
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rim}" fill="#0e1015"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{rim}" fill="url(#rim-{uid})"/>')
    # dark gaps between spokes, drawn as wedges from the hub outward
    for i in range(spokes):
        a = math.radians(i * (360 / spokes))
        half = math.radians(180 / spokes - 2.1)
        p1 = (cx + math.cos(a - half) * rim * 0.22, cy + math.sin(a - half) * rim * 0.22)
        p2 = (cx + math.cos(a - half) * rim * 0.95, cy + math.sin(a - half) * rim * 0.95)
        p3 = (cx + math.cos(a + half) * rim * 0.95, cy + math.sin(a + half) * rim * 0.95)
        p4 = (cx + math.cos(a + half) * rim * 0.22, cy + math.sin(a + half) * rim * 0.22)
        out.append(
            f'<path d="M {p1[0]:.1f},{p1[1]:.1f} L {p2[0]:.1f},{p2[1]:.1f} '
            f'A {rim * 0.95:.1f},{rim * 0.95:.1f} 0 0 1 {p3[0]:.1f},{p3[1]:.1f} '
            f'L {p4[0]:.1f},{p4[1]:.1f} A {rim * 0.22:.1f},{rim * 0.22:.1f} 0 0 0 {p1[0]:.1f},{p1[1]:.1f} Z" '
            f'fill="#12151b"/>'
        )
    out += [
        f'<circle cx="{cx}" cy="{cy}" r="{rim * 0.24:.1f}" fill="url(#rim-{uid})" stroke="#4e5560" stroke-width="2"/>',
        f'<circle cx="{cx}" cy="{cy}" r="{rim * 0.1:.1f}" fill="#262b34"/>',
        f'<path d="M {cx - r * 0.86:.1f},{cy - r * 0.3:.1f} a {r:.1f},{r:.1f} 0 0 1 {r * 0.42:.1f},{-r * 0.56:.1f}" '
        f'fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="{r * 0.045:.1f}" stroke-linecap="round"/>',
    ]
    return "\n      ".join(out)


def car_svg(cfg: dict) -> str:
    uid = cfg["id"]
    suv = cfg["type"] == "suv"

    ground = 700.0
    wr = 90.0 if suv else 80.0
    fwx, rwx = 344.0, 872.0
    bf, br = 118.0, 1082.0
    sill = 606.0 if suv else 596.0
    bottom = sill + 8
    belt = 470.0 if suv else 486.0
    roof = 344.0 if suv else 396.0
    hood = 474.0 if suv else 500.0
    wsx, wtx = 512.0, 628.0
    rex, rbx = 876.0, 988.0
    # Arch cut-out: a circle centred on the wheel hub, so the opening follows
    # the tyre instead of painting body colour over it.
    arch_r = wr + 14
    drop = ground - bottom
    arch_dx = math.sqrt(max(arch_r ** 2 - drop ** 2, 1.0))

    body = (
        f"M {bf},{bottom} "
        f"C {bf - 10},{bottom - 58} {bf + 2},{bottom - 106} {bf + 42},{bottom - 118} "
        f"C {bf + 46},{hood + 26} {bf + 68},{hood + 2} {bf + 112},{hood} "
        f"C {bf + 186},{hood - 4} {bf + 320},{hood - 6} {wsx - 14},{hood - 6} "
        f"C {wsx - 2},{hood - 12} {wsx + 4},{belt + 2} {wsx + 10},{belt} "
        f"L {wtx},{roof} "
        f"C {wtx + 62},{roof - 10} {rex - 68},{roof - 12} {rex},{roof} "
        f"L {rbx},{belt + 12} "
        f"C {rbx + 30},{belt + 20} {br - 38},{belt + 34} {br - 12},{belt + 54} "
        f"C {br + 2},{belt + 92} {br + 2},{sill - 30} {br - 4},{bottom - 4} "
        f"L {br - 8},{bottom} "
        f"L {rwx + arch_dx:.1f},{bottom} "
        f"A {arch_r},{arch_r} 0 0 0 {rwx - arch_dx:.1f},{bottom} "
        f"L {fwx + arch_dx:.1f},{bottom} "
        f"A {arch_r},{arch_r} 0 0 0 {fwx - arch_dx:.1f},{bottom} "
        f"L {bf},{bottom} Z"
    )
    glass = (
        f"M {wsx + 22},{belt - 10} L {wtx + 8},{roof + 18} "
        f"C {wtx + 78},{roof + 8} {rex - 82},{roof + 6} {rex - 8},{roof + 16} "
        f"L {rbx - 16},{belt - 2} Z"
    )
    # front fascia: a narrow wedge of the front face so the grille and lamp read
    # A narrow slice of the front face: enough to read the grille and lamp
    # without inventing a full three-quarter view.
    front_face = (
        f"M {bf + 2},{bottom - 6} C {bf - 6},{bottom - 62} {bf + 2},{bottom - 110} {bf + 34},{bottom - 120} "
        f"L {bf + 54},{bottom - 108} C {bf + 40},{bottom - 72} {bf + 40},{bottom - 30} {bf + 46},{bottom - 4} Z"
    )
    lamp = (
        f"M {bf + 58},{hood + 14} C {bf + 128},{hood + 4} {bf + 198},{hood + 12} {bf + 246},{hood + 36} "
        f"C {bf + 224},{hood + 58} {bf + 152},{hood + 60} {bf + 102},{hood + 48} Z"
    )
    grille = (
        f"M {bf + 8},{hood + 52} C {bf + 4},{hood + 90} {bf + 6},{sill - 104} {bf + 14},{sill - 86} "
        f"L {bf + 44},{sill - 84} C {bf + 38},{sill - 116} {bf + 38},{hood + 56} {bf + 44},{hood + 48} Z"
    )
    slats = "".join(
        f'<path d="M {bf + 16 + i * 9},{hood + 56 + i} L {bf + 19 + i * 9},{sill - 90 - i}" '
        f'stroke="#c9ced7" stroke-opacity="0.3" stroke-width="2.2"/>'
        for i in range(3)
    )

    rails = ""
    if suv and cfg.get("rails", True):
        rails = (
            f'<rect x="{wtx + 30}" y="{roof - 9}" width="{rex - wtx - 48}" height="8" rx="4" fill="#23272f"/>'
            f'<rect x="{wtx + 30}" y="{roof - 9}" width="{rex - wtx - 48}" height="2.6" rx="1.3" fill="#767d87"/>'
        )

    bodygroup = f"""
    <g>
      <path d="{body}" fill="url(#paint-{uid})" stroke="{cfg['edge']}" stroke-width="2.2" stroke-opacity="0.6"/>
      <!-- shoulder line and lower crease -->
      <path d="M {bf + 150},{hood + 26} C {bf + 300},{hood + 16} {wsx + 130},{belt + 30} {br - 44},{belt + 56}"
            fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="3" stroke-linecap="round"/>
      <path d="M {bf + 92},{sill - 52} C {fwx + 190},{sill - 30} {rwx - 70},{sill - 36} {br - 66},{sill - 64}"
            fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="6" stroke-linecap="round"/>
      <path d="M {bf + 92},{sill - 40} C {fwx + 190},{sill - 18} {rwx - 70},{sill - 24} {br - 66},{sill - 52}"
            fill="none" stroke="#000000" stroke-opacity="0.26" stroke-width="9" stroke-linecap="round"/>
      <!-- rocker between the arches -->
      <path d="M {fwx + arch_dx + 6},{bottom - 4} L {rwx - arch_dx - 6},{bottom - 4}"
            stroke="#0c0e13" stroke-opacity="0.9" stroke-width="9" stroke-linecap="round"/>
      <!-- wheel arch trims -->
      <path d="M {fwx - arch_dx:.1f},{bottom} A {arch_r},{arch_r} 0 0 1 {fwx + arch_dx:.1f},{bottom}"
            fill="none" stroke="#0f1218" stroke-opacity="0.8" stroke-width="10"/>
      <path d="M {rwx - arch_dx:.1f},{bottom} A {arch_r},{arch_r} 0 0 1 {rwx + arch_dx:.1f},{bottom}"
            fill="none" stroke="#0f1218" stroke-opacity="0.8" stroke-width="10"/>
      <!-- door cuts, flush handles -->
      <path d="M {wsx + 16},{belt + 22} L {wsx + 20},{sill - 10}" stroke="#000000" stroke-opacity="0.25" stroke-width="2"/>
      <path d="M {wsx + 236},{belt + 16} L {wsx + 242},{sill - 10}" stroke="#000000" stroke-opacity="0.22" stroke-width="2"/>
      <rect x="{wsx + 92}" y="{belt + 60}" width="52" height="9" rx="4.5" fill="#0f1116" fill-opacity="0.8"/>
      <rect x="{wsx + 300}" y="{belt + 56}" width="52" height="9" rx="4.5" fill="#0f1116" fill-opacity="0.8"/>
      <!-- mirror -->
      <path d="M {wsx + 10},{belt + 6} l 42,-10 l 10,22 l -46,14 Z" fill="{cfg['paint2']}"
            stroke="{cfg['edge']}" stroke-width="1.6"/>
      <!-- glasshouse -->
      <path d="{glass}" fill="url(#glass-{uid})" stroke="#0b0e14" stroke-opacity="0.8" stroke-width="2"/>
      <path d="M {wsx + 140},{belt - 6} L {wsx + 300},{roof + 10} L {wsx + 338},{roof + 10} L {wsx + 178},{belt - 6} Z"
            fill="#ffffff" fill-opacity="0.16"/>
      <path d="{glass}" fill="none" stroke="url(#chrome-{uid})" stroke-width="3.5" stroke-opacity="0.9"/>
      {rails}
      <!-- front face, grille and lamp -->
      <path d="{front_face}" fill="url(#grille-{uid})" stroke="#0a0c11" stroke-width="2"/>
      <path d="{grille}" fill="#0b0d13" stroke="#05070b" stroke-width="2"/>
      {slats}
      <circle cx="{bf + 74}" cy="{sill - 132}" r="8" fill="#cfd7e2" fill-opacity="0.55"/>
      <path d="{lamp}" fill="url(#lamp-{uid})" stroke="#0d1420" stroke-width="2"/>
      <ellipse cx="{bf + 156}" cy="{hood + 30}" rx="23" ry="15" fill="#19222f"/>
      <ellipse cx="{bf + 156}" cy="{hood + 30}" rx="13" ry="8" fill="url(#lens-{uid})"/>
      <path d="M {bf + 72},{hood + 40} C {bf + 124},{hood + 42} {bf + 186},{hood + 36} {bf + 232},{hood + 24}"
            stroke="#ffffff" stroke-opacity="0.85" stroke-width="4" stroke-linecap="round"/>
      <path d="M {bf + 46},{hood + 64} C {bf + 112},{hood + 56} {bf + 172},{hood + 58} {bf + 216},{hood + 66}"
            stroke="#000000" stroke-opacity="0.16" stroke-width="3" stroke-linecap="round"/>
      <!-- lower bumper vent and fog lamp -->
      <path d="M {bf + 54},{sill - 56} C {bf + 100},{sill - 60} {bf + 152},{sill - 58} {bf + 190},{sill - 50}
               L {bf + 186},{sill - 36} C {bf + 148},{sill - 32} {bf + 100},{sill - 34} {bf + 56},{sill - 40} Z"
            fill="#0b0d13" stroke="#05070b" stroke-width="2"/>
      <!-- tail lamp and exhaust -->
      <path d="M {br - 34},{belt + 44} l 26,6 l 4,42 l -30,-8 Z" fill="#b3261e"/>
      <path d="M {br - 28},{belt + 58} l 16,3" stroke="#ffbcb6" stroke-width="3"/>
      <rect x="{br - 66}" y="{bottom - 16}" width="34" height="12" rx="6" fill="#a3aab6"/>
      <rect x="{br - 60}" y="{bottom - 13}" width="20" height="6" rx="3" fill="#1a1e25"/>
    </g>"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="{cfg['label']}">
  <title>{cfg['label']}</title>
{backdrop(uid, cfg)}  <defs>
{paint_defs(uid, cfg)}  </defs>

  <ellipse cx="600" cy="708" rx="500" ry="30" fill="url(#contact-{uid})"/>

  <g mask="url(#refl-mask-{uid})" transform="translate(0,1400) scale(1,-1)" opacity="0.32">
{bodygroup}
  </g>

{bodygroup}

  <g>
      {wheel(uid, fwx, ground, wr)}
      {wheel(uid, rwx, ground, wr)}
  </g>
</svg>
"""


def brake_svg() -> str:
    uid = "brake"
    cx, cy, r = 566.0, 432.0, 234.0

    holes, slots = [], []
    for ring, count, rad, hr in ((0.82, 30, 0.0, 6.5), (0.66, 24, 6.0, 7.5)):
        for i in range(count):
            a = math.radians(i * (360 / count) + rad)
            holes.append(
                f'<circle cx="{cx + math.cos(a) * r * ring:.1f}" cy="{cy + math.sin(a) * r * ring:.1f}" '
                f'r="{hr}" fill="#0e1117"/>'
            )
    for i in range(10):
        a = math.radians(i * 36)
        a2 = a + 0.19
        slots.append(
            f'<path d="M {cx + math.cos(a) * r * 0.42:.1f},{cy + math.sin(a) * r * 0.42:.1f} '
            f'Q {cx + math.cos(a + 0.09) * r * 0.7:.1f},{cy + math.sin(a + 0.09) * r * 0.7:.1f} '
            f'{cx + math.cos(a2) * r * 0.94:.1f},{cy + math.sin(a2) * r * 0.94:.1f}" '
            f'stroke="#101419" stroke-width="7" stroke-linecap="round" fill="none"/>'
        )

    # caliper: a bridge wrapping the disc edge from 10 to 1 o'clock
    a1, a2 = math.radians(-138), math.radians(-42)
    R1, R2 = r * 1.02, r * 0.55

    def pt(radius: float, angle: float) -> str:
        return f"{cx + math.cos(angle) * radius:.1f},{cy + math.sin(angle) * radius:.1f}"

    caliper = (
        f"M {pt(R1, a1)} A {R1},{R1} 0 0 1 {pt(R1, a2)} "
        f"L {pt(R2, a2)} A {R2},{R2} 0 0 0 {pt(R2, a1)} Z"
    )
    pad = (
        f"M {pt(r * 0.94, a1 + 0.06)} A {r * 0.94},{r * 0.94} 0 0 1 {pt(r * 0.94, a2 - 0.06)} "
        f"L {pt(r * 0.8, a2 - 0.06)} A {r * 0.8},{r * 0.8} 0 0 0 {pt(r * 0.8, a1 + 0.06)} Z"
    )
    bolts = "".join(
        f'<circle cx="{cx + math.cos(a) * r * 0.86:.1f}" cy="{cy + math.sin(a) * r * 0.86:.1f}" r="8" '
        f'fill="#2b0b08" stroke="#7d1d16" stroke-width="2"/>'
        for a in (a1 + 0.14, a1 + 0.44, a2 - 0.44, a2 - 0.14)
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="کیت ترمز جلو پورشه کاین">
  <title>OEM big-brake kit</title>
{backdrop(uid, {"wall_top": "#1b2233", "wall_bottom": "#0b1018", "floor_top": "#121822", "floor_bottom": "#04060a", "halo": "#93b7e8"})}  <defs>
    <radialGradient id="disc-{uid}" cx="0.36" cy="0.3" r="0.82">
      <stop offset="0" stop-color="#f4f7fb"/>
      <stop offset="0.34" stop-color="#c2c9d3"/>
      <stop offset="0.64" stop-color="#89919d"/>
      <stop offset="0.86" stop-color="#5a626d"/>
      <stop offset="1" stop-color="#8f97a3"/>
    </radialGradient>
    <linearGradient id="caliper-{uid}" x1="0.1" y1="0" x2="0.5" y2="1">
      <stop offset="0" stop-color="#ef6b5e"/>
      <stop offset="0.3" stop-color="#c93029"/>
      <stop offset="0.72" stop-color="#8f1a14"/>
      <stop offset="1" stop-color="#4f0c08"/>
    </linearGradient>
    <linearGradient id="pad-{uid}" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#59616d"/>
      <stop offset="0.5" stop-color="#2b313a"/>
      <stop offset="1" stop-color="#14181f"/>
    </linearGradient>
  </defs>
  <ellipse cx="600" cy="726" rx="400" ry="28" fill="url(#contact-{uid})"/>
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#disc-{uid})" stroke="#242a32" stroke-width="4"/>
  <circle cx="{cx}" cy="{cy}" r="{r * 0.995:.1f}" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="4"/>
  <circle cx="{cx}" cy="{cy}" r="{r * 0.92:.1f}" fill="none" stroke="#2c333c" stroke-opacity="0.55" stroke-width="7"/>
  {''.join(slots)}
  {''.join(holes)}
  <circle cx="{cx}" cy="{cy}" r="{r * 0.46:.1f}" fill="#6a727e"/>
  <circle cx="{cx}" cy="{cy}" r="{r * 0.44:.1f}" fill="url(#disc-{uid})" stroke="#2a3038" stroke-width="3"/>
  <circle cx="{cx}" cy="{cy}" r="{r * 0.17:.1f}" fill="#141820"/>
  <circle cx="{cx}" cy="{cy}" r="{r * 0.17:.1f}" fill="none" stroke="#9aa3b0" stroke-width="2"/>
  {''.join(
      f'<circle cx="{cx + math.cos(math.radians(i * 72 + 18)) * r * 0.31:.1f}" cy="{cy + math.sin(math.radians(i * 72 + 18)) * r * 0.31:.1f}" r="10" fill="#1d2229" stroke="#aab3c0" stroke-width="2"/>'
      for i in range(5)
  )}
  <path d="{caliper}" fill="url(#caliper-{uid})" stroke="#3d0a06" stroke-width="3"/>
  <path d="{caliper}" fill="none" stroke="#ffb3ab" stroke-opacity="0.35" stroke-width="2" transform="translate(-3,-4)"/>
  <path d="{pad}" fill="url(#pad-{uid})" stroke="#0f1319" stroke-width="2"/>
  <path d="M {pt(r * 0.99, a1 + 0.2)} A {r * 0.99},{r * 0.99} 0 0 1 {pt(r * 0.99, a2 - 0.2)}"
        fill="none" stroke="#ffffff" stroke-opacity="0.4" stroke-width="6" stroke-linecap="round"/>
  {bolts}
  <g transform="translate(812,616)">
    <rect x="0" y="0" width="188" height="30" rx="9" fill="url(#pad-{uid})" transform="rotate(-7)"/>
    <rect x="4" y="4" width="180" height="6" rx="3" fill="#ffffff" fill-opacity="0.16" transform="rotate(-7)"/>
    <rect x="10" y="38" width="188" height="30" rx="9" fill="url(#pad-{uid})" transform="rotate(-3)"/>
    <rect x="14" y="42" width="180" height="6" rx="3" fill="#ffffff" fill-opacity="0.16" transform="rotate(-3)"/>
  </g>
  <path d="M 300,600 C 250,660 220,700 190,712" stroke="#39404a" stroke-width="7" fill="none" stroke-linecap="round"/>
  <path d="M 300,600 C 250,660 220,700 190,712" stroke="#8f98a5" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>
"""


def gearbox_svg() -> str:
    uid = "gearbox"
    ribs = "".join(
        f'<path d="M {332 + i * 26},400 v 176" stroke="#0e1218" stroke-opacity="0.45" stroke-width="8"/>'
        f'<path d="M {337 + i * 26},402 v 172" stroke="#ffffff" stroke-opacity="0.14" stroke-width="3"/>'
        for i in range(11)
    )
    bolts = "".join(
        f'<circle cx="{372 + (i % 5) * 92}" cy="{372 + (i // 5) * 212}" r="9" fill="#2b3139" stroke="#b3bac5" stroke-width="2"/>'
        for i in range(10)
    )
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900" role="img" aria-label="گیربکس اتوماتیک لندکروزر VXR">
  <title>OEM automatic transmission</title>
{backdrop(uid, {"wall_top": "#1a2130", "wall_bottom": "#0b1017", "floor_top": "#101620", "floor_bottom": "#04060a", "halo": "#9ec0f0"})}  <defs>
    <linearGradient id="alu-{uid}" x1="0" y1="0" x2="0.22" y2="1">
      <stop offset="0" stop-color="#f7fafd"/>
      <stop offset="0.24" stop-color="#ccd3dc"/>
      <stop offset="0.5" stop-color="#828b97"/>
      <stop offset="0.74" stop-color="#aab2bd"/>
      <stop offset="1" stop-color="#545b66"/>
    </linearGradient>
    <linearGradient id="alu2-{uid}" x1="0" y1="0" x2="0.55" y2="1">
      <stop offset="0" stop-color="#dde3ea"/>
      <stop offset="0.5" stop-color="#98a1ac"/>
      <stop offset="1" stop-color="#4f565f"/>
    </linearGradient>
    <radialGradient id="bell-{uid}" cx="0.32" cy="0.28" r="0.82">
      <stop offset="0" stop-color="#f1f5fa"/>
      <stop offset="0.58" stop-color="#a7b0bb"/>
      <stop offset="1" stop-color="#535a65"/>
    </radialGradient>
  </defs>
  <ellipse cx="600" cy="726" rx="430" ry="28" fill="url(#contact-{uid})"/>
  <g>
    <path d="M 250,432 C 250,352 322,316 404,316 L 756,316 C 852,316 930,358 930,432 L 930,548 C 930,622 852,664 756,664 L 404,664 C 322,664 250,628 250,548 Z"
          fill="url(#alu-{uid})" stroke="#2a3039" stroke-width="4"/>
    <path d="M 250,432 C 250,352 322,316 404,316 L 756,316 C 852,316 930,358 930,432"
          fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="6"/>
    {ribs}
    {bolts}
    <rect x="300" y="352" width="610" height="16" rx="8" fill="#eef2f8" fill-opacity="0.5"/>
    <path d="M 606,316 C 606,258 674,228 744,228 C 826,228 886,266 886,324 L 886,326 L 606,326 Z"
          fill="url(#bell-{uid})" stroke="#2a3039" stroke-width="4"/>
    <circle cx="748" cy="274" r="56" fill="url(#alu2-{uid})" stroke="#383f49" stroke-width="4"/>
    <circle cx="748" cy="274" r="27" fill="#191d24"/>
    <circle cx="748" cy="274" r="11" fill="#bcc4cf"/>
    {''.join(
        f'<circle cx="{748 + math.cos(math.radians(a)) * 44:.1f}" cy="{274 + math.sin(math.radians(a)) * 44:.1f}" r="6" fill="#2a3039" stroke="#ccd4de" stroke-width="1.5"/>'
        for a in range(0, 360, 45)
    )}
    <rect x="892" y="474" width="148" height="88" rx="16" fill="url(#alu2-{uid})" stroke="#383f49" stroke-width="4"/>
    <rect x="1006" y="500" width="34" height="36" rx="7" fill="#8c95a1" stroke="#383f49" stroke-width="3"/>
    <circle cx="1000" cy="498" r="7" fill="#20252c"/><circle cx="1000" cy="538" r="7" fill="#20252c"/>
    <path d="M 328,566 h 476" stroke="#ffffff" stroke-opacity="0.16" stroke-width="11" stroke-linecap="round"/>
    <path d="M 328,592 h 476" stroke="#000000" stroke-opacity="0.26" stroke-width="13" stroke-linecap="round"/>
    <rect x="404" y="606" width="300" height="14" rx="7" fill="#3d444e" fill-opacity="0.7"/>
    <rect x="430" y="420" width="330" height="8" rx="4" fill="#ffffff" fill-opacity="0.22"/>
    <rect x="430" y="436" width="250" height="6" rx="3" fill="#000000" fill-opacity="0.18"/>
  </g>
  <g transform="translate(752,668)">
    <rect x="0" y="0" width="212" height="19" rx="9" fill="#b7bfca" transform="rotate(-6)"/>
    <rect x="8" y="26" width="212" height="19" rx="9" fill="#7f8894" transform="rotate(-3)"/>
  </g>
</svg>
"""


CARS = [
    dict(id="land-cruiser", label="Toyota Land Cruiser VXR", type="suv",
         paint="#fbfcfd", paint2="#e2e7ec", shade="#9aa3ad", edge="#6f7681",
         wall_top="#242e40", wall_bottom="#0a0e16", floor_top="#141a25", floor_bottom="#04060a",
         halo="#cfe0f7"),
    dict(id="patrol", label="Nissan Patrol Platinum", type="suv",
         paint="#33383f", paint2="#1b1f26", shade="#0a0d12", edge="#4a505a",
         wall_top="#1d2433", wall_bottom="#080c13", floor_top="#11161f", floor_bottom="#04060a",
         halo="#9fc2f0"),
    dict(id="s-class", label="Mercedes-Benz S-Class", type="sedan",
         paint="#d4d9e0", paint2="#a8aeb8", shade="#63696f", edge="#5a616b",
         wall_top="#20293a", wall_bottom="#0a0e16", floor_top="#121822", floor_bottom="#05070b",
         halo="#d6e6ff"),
    dict(id="x5", label="BMW X5 xDrive40i", type="suv",
         paint="#f7f9fb", paint2="#d9dee5", shade="#8f979f", edge="#6a717b",
         wall_top="#1e2636", wall_bottom="#080d15", floor_top="#131924", floor_bottom="#04060a",
         halo="#c6dcf8"),
    dict(id="cayenne", label="Porsche Cayenne", type="suv",
         paint="#262b33", paint2="#151a20", shade="#07090d", edge="#424851",
         wall_top="#1b2230", wall_bottom="#070a11", floor_top="#101620", floor_bottom="#04060a",
         halo="#a9cbf2"),
    dict(id="lexus-rx", label="Lexus RX 350", type="suv",
         paint="#f1f4f7", paint2="#ccd2d9", shade="#8b939c", edge="#666d77",
         wall_top="#232c3b", wall_bottom="#090d15", floor_top="#121822", floor_bottom="#05070b",
         halo="#cfdff6"),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.mkdir(parents=True, exist_ok=True)
    written = []
    for cfg in CARS:
        (OUT / f"{cfg['id']}.svg").write_text(car_svg(cfg), encoding="utf-8")
        written.append(f"{cfg['id']}.svg")
    for name, svg in (("part-brake", brake_svg()), ("part-gearbox", gearbox_svg())):
        (OUT / f"{name}.svg").write_text(svg, encoding="utf-8")
        written.append(f"{name}.svg")
    print("wrote", ", ".join(written))

    try:
        import cairosvg  # type: ignore
    except Exception:  # pragma: no cover - preview only
        cairosvg = None
    if cairosvg is None:
        print("preview skipped: install cairosvg or use sharp to rasterise")
        return
    for name in written:
        cairosvg.svg2png(bytestring=(OUT / name).read_bytes(),
                         write_to=str(PREVIEW / f"{name[:-4]}.png"),
                         output_width=1200, output_height=900)
    print("previews in", PREVIEW)


if __name__ == "__main__":
    main()
