import { describe, expect, it } from 'vitest';
import { ICONS, ICON_STROKE_WIDTH, ICON_VIEWBOX } from '../src/icons';
import { STATUS_BADGES, badgeKeys } from '../src/status';

const PATH_CHARACTERS = /^[MmLlHhVvCcSsQqTtAaZz0-9\s.,-]+$/;

describe('shared icon registry', () => {
  it('is a 24×24 grid with uniform 1.5 stroke', () => {
    expect(ICON_VIEWBOX).toBe('0 0 24 24');
    expect(ICON_STROKE_WIDTH).toBe(1.5);
  });

  it('every icon has at least one valid path', () => {
    for (const [name, def] of Object.entries(ICONS)) {
      expect(def.paths.length, name).toBeGreaterThan(0);
      for (const d of def.paths) {
        expect(d, `${name}: ${d}`).toMatch(/^M/i); // starts with a moveto
        expect(d, `${name}: ${d}`).toMatch(PATH_CHARACTERS); // only path syntax
        expect(d.length, name).toBeGreaterThan(3);
      }
    }
  });

  it('contains no hard-coded colors — icons inherit currentColor', () => {
    expect(JSON.stringify(ICONS)).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  it('only heartFilled renders filled (all others are stroke outlines)', () => {
    const entries = Object.entries(ICONS) as Array<[string, { filled?: boolean }]>
    const filled = entries
      .filter(([, def]) => def.filled)
      .map(([name]) => name);
    expect(filled).toEqual(['heartFilled']);
  });

  it('icon names are unique and camelCase', () => {
    const names = Object.keys(ICONS);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-zA-Z0-9]*$/);
  });

  it('every status badge icon exists in the registry', () => {
    for (const key of badgeKeys) {
      const icon = STATUS_BADGES[key].icon;
      expect(ICONS, `${key} → ${icon}`).toHaveProperty(icon);
    }
  });

  it('ships the icon set both apps depend on', () => {
    const required = [
      'menu', 'close', 'arrowLeft', 'chevronDown', 'search', 'sliders',
      'plus', 'check', 'send', 'trash', 'heart', 'heartFilled',
      'camera', 'cameraPlus', 'image', 'imageX',
      'shieldCheck', 'clock', 'plate', 'sparkle', 'badgeCheck', 'car', 'alertCircle',
      'home', 'message', 'user',
      'sun', 'moon', 'grid', 'list', 'phone',
      'mileage', 'fuel', 'gear',
    ];
    for (const name of required) {
      expect(ICONS, name).toHaveProperty(name);
    }
  });
});
