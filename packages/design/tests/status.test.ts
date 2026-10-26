import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CORE_BADGES,
  LIFECYCLE_STATES,
  STATUS_BADGES,
  badgeKeys,
  lifecycleTagFor,
  tagsForListing,
} from '../src/status';
import { badgeTag, cssTokenName, statusTag } from '../src/tokens';
import { contrast } from './tokens.test';

const css = readFileSync(
  fileURLToPath(new URL('../src/tokens.css', import.meta.url)),
  'utf8',
);

describe('status badge registry', () => {
  it('covers exactly the five core product badges', () => {
    expect(CORE_BADGES).toEqual([
      'new',
      'used',
      'kish_plate',
      'temporary_transit',
      'verified_report',
    ]);
  });

  it('every badge has a fixed color triple, Persian label and icon token', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      expect(b.background, key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(b.foreground, key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(b.border, key).toMatch(/^#[0-9a-f]{6}$/i);
      expect(b.icon, key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
      // Persian label — except `sold`, whose label is English by final
      // product decision (D2: "Sold").
      if (key !== 'sold') expect(b.label, key).toMatch(/[آ-ی]/);
      expect(b.label.trim().length, key).toBeGreaterThan(0);
    }
    expect(STATUS_BADGES.sold.label).toBe('Sold');
  });

  it('badge border is the same color as the tag text (approved decision)', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      expect(b.border, key).toBe(b.foreground);
    }
  });

  it('badge text passes WCAG AA on its own background', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      const ratio = contrast(b.foreground, b.background);
      expect(ratio, `${key}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the five core badges keep unique color pairs (distinguishability)', () => {
    const seen = new Set<string>();
    for (const key of CORE_BADGES) {
      const b = STATUS_BADGES[key];
      const pair = `${b.background}|${b.foreground}`;
      expect(seen.has(pair), `${key} clashes with another core badge`).toBe(false);
      seen.add(pair);
    }
    expect(seen.size).toBe(CORE_BADGES.length);
  });

  it('every badge renders a statusTag pair — no color outside statusTag exists', () => {
    const allowed = new Set(
      Object.values(statusTag).map((p) => `${p.bg}|${p.text}`),
    );
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      expect(
        allowed.has(`${b.background}|${b.foreground}`),
        `${key} uses ${b.background}/${b.foreground} which is not a statusTag pair`,
      ).toBe(true);
      // and the mapping table agrees with the rendered pair
      const tag = statusTag[badgeTag[key]];
      expect(b.background, key).toBe(tag.bg);
      expect(b.foreground, key).toBe(tag.text);
    }
  });

  it('each badge has a unique icon token', () => {
    const icons = badgeKeys.map((k) => STATUS_BADGES[k].icon);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('CSS mirrors every badge pair through --status-tag-* variables', () => {
    for (const key of badgeKeys) {
      const b = STATUS_BADGES[key];
      const kebab = cssTokenName(badgeTag[key]);
      expect(css, `${key} bg`).toContain(
        `--status-tag-${kebab}-bg: ${b.background}`,
      );
      expect(css, `${key} text`).toContain(
        `--status-tag-${kebab}-text: ${b.foreground}`,
      );
    }
  });

  it('uses the approved labels and icons', () => {
    expect(STATUS_BADGES.verified_report.label).toBe('گزارش تاییدشده');
    expect(STATUS_BADGES.used.icon).toBe('car');
  });
});

describe('tagsForListing (card tag semantics — max two)', () => {
  it('standard plate stays exactly one tag (condition), report suppressed', () => {
    expect(tagsForListing('new', 'standard', false)).toEqual(['new']);
    expect(tagsForListing('used', 'standard', false)).toEqual(['used']);
    expect(tagsForListing('new', 'standard', true)).toEqual(['new']);
    expect(tagsForListing('used', 'standard', true)).toEqual(['used']);
  });

  it('kish plate replaces the condition; report appends (max two)', () => {
    expect(tagsForListing('used', 'kish', false)).toEqual(['kish_plate']);
    expect(tagsForListing('used', 'kish', true)).toEqual([
      'kish_plate',
      'verified_report',
    ]);
    expect(tagsForListing('new', 'kish', true)).toEqual([
      'kish_plate',
      'verified_report',
    ]);
  });

  it('temporary transit and unplated render the transit tag', () => {
    expect(tagsForListing('new', 'temporary_transit', false)).toEqual([
      'temporary_transit',
    ]);
    expect(tagsForListing('new', 'unplated', true)).toEqual([
      'temporary_transit',
      'verified_report',
    ]);
  });

  it('never exceeds two tags for any input combination', () => {
    const conditions = ['new', 'used'] as const;
    const plates = ['standard', 'kish', 'temporary_transit', 'unplated'] as const;
    for (const condition of conditions) {
      for (const plateType of plates) {
        for (const hasReport of [false, true]) {
          const tags = tagsForListing(condition, plateType, hasReport);
          expect(tags.length).toBeLessThanOrEqual(2);
          expect(tags.length).toBeGreaterThanOrEqual(1);
          for (const tag of tags) expect(badgeKeys).toContain(tag);
        }
      }
    }
  });
});

describe('sold lifecycle mapping (Phase 2 / D2: sold keeps its badge)', () => {
  it('covers exactly the seven schema lifecycle states, sold among them', () => {
    expect([...LIFECYCLE_STATES]).toEqual([
      'draft',
      'pending_review',
      'active',
      'paused',
      'sold',
      'expired',
      'rejected',
    ]);
    // registry structure: five core badges followed by the seven lifecycle keys
    expect([...badgeKeys]).toEqual([...CORE_BADGES, ...LIFECYCLE_STATES]);
  });

  it('sold resolves to its own lifecycle badge', () => {
    expect(lifecycleTagFor('sold')).toBe('sold');
  });

  it('every lifecycle state maps to its own badge entry', () => {
    for (const state of LIFECYCLE_STATES) {
      const resolved = lifecycleTagFor(state);
      expect(resolved, state).toBe(state);
      expect(STATUS_BADGES[resolved as keyof typeof STATUS_BADGES], state)
        .toBeDefined();
    }
  });

  it('sold uses exactly the approved transit pair (#F98513 / #111144)', () => {
    const b = STATUS_BADGES.sold;
    expect(b.background).toBe('#F98513');
    expect(b.foreground).toBe('#111144');
    // same pair as the temporary_transit tag — no new color enters the palette
    expect(b.background).toBe(STATUS_BADGES.temporary_transit.background);
    expect(b.foreground).toBe(STATUS_BADGES.temporary_transit.foreground);
  });

  it('sold badge text passes WCAG AA on its own background', () => {
    const b = STATUS_BADGES.sold;
    const ratio = contrast(b.foreground, b.background);
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it('a sold card still carries only the five approved core tags (plus its sold badge)', () => {
    const conditions = ['new', 'used'] as const;
    const plates = ['standard', 'kish', 'temporary_transit', 'unplated'] as const;
    for (const condition of conditions) {
      for (const plateType of plates) {
        for (const hasReport of [false, true]) {
          const tags = tagsForListing(condition, plateType, hasReport);
          expect(tags.length, `${condition}/${plateType}`).toBeGreaterThanOrEqual(1);
          for (const tag of tags) {
            expect(CORE_BADGES, `${tag} is outside the five approved tags`).toContain(
              tag,
            );
          }
        }
      }
    }
  });
});
