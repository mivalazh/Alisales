import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CanonicalizationError,
  canonicalize,
  isSha256Hex,
  sha256HexOfString,
  sha256Of,
  verifyContentHash,
} from '../src/index';

const sampleReport = {
  reportVersion: 1,
  identity: { brand: 'ikco', model: 'پژو ۲۰۶', year: 1398, vin: null },
  mileageKm: 128_450,
  panels: [
    { panel: 'hood', condition: 'original' },
    { panel: 'roof', condition: 'repainted' },
  ],
  accidentHistory: [],
  finalizedAt: '2026-10-19T08:30:00.000Z',
};

/** Golden vector: fixed canonical text → fixed SHA-256 (locked by this test). */
const GOLDEN_CANONICAL = '{"a":1,"b":"ایران"}';
const GOLDEN_SHA256 = '9b9109b5e5b21f31f17028444793286d2c19ab60e55ae7c7ee1db85c4ea39eba';

describe('canonicalization', () => {
  it('sorts object keys recursively, preserves array order', () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it('is key-order independent', () => {
    const a = canonicalize({ x: 1, y: 2, nested: { p: true, q: null } });
    const b = canonicalize({ nested: { q: null, p: true }, y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it('normalizes Unicode to NFC (decomposed Persian text hashes equally)', () => {
    const composed = 'مأمور کیش'.normalize('NFC'); // أ stays one code point
    const decomposed = composed.normalize('NFD'); // أ splits into ا + ؍
    expect(composed).not.toBe(decomposed);
    expect(canonicalize({ t: composed })).toBe(canonicalize({ t: decomposed }));
  });

  it('drops undefined properties and normalizes -0', () => {
    expect(canonicalize({ a: undefined, b: -0 })).toBe('{"b":0}');
  });

  it('rejects non-finite numbers and bigints', () => {
    expect(() => canonicalize({ a: Number.NaN })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ a: Infinity })).toThrow(CanonicalizationError);
    expect(() => canonicalize({ a: 1n })).toThrow(CanonicalizationError);
  });

  it('serializes Dates as ISO-8601 UTC', () => {
    expect(canonicalize({ d: new Date('2026-10-19T08:30:00Z') })).toBe('{"d":"2026-10-19T08:30:00.000Z"}');
  });
});

describe('sha256', () => {
  it('matches an independent node:crypto implementation', async () => {
    const canonical = canonicalize(sampleReport);
    const expected = createHash('sha256').update(canonical, 'utf8').digest('hex');
    expect(await sha256Of(sampleReport)).toBe(expected);
  });

  it('produces the golden vector hash', async () => {
    expect(canonicalize({ b: 'ایران', a: 1 })).toBe(GOLDEN_CANONICAL);
    expect(await sha256HexOfString(GOLDEN_CANONICAL)).toBe(GOLDEN_SHA256);
    expect(await sha256Of({ b: 'ایران', a: 1 })).toBe(GOLDEN_SHA256);
  });

  it('always returns 64 lowercase hex chars', async () => {
    const h = await sha256Of(sampleReport);
    expect(isSha256Hex(h)).toBe(true);
  });

  it('same content in any key order → same hash; changed content → different hash', async () => {
    const h1 = await sha256Of(sampleReport);
    const h2 = await sha256Of({
      finalizedAt: sampleReport.finalizedAt,
      accidentHistory: [],
      panels: sampleReport.panels,
      mileageKm: sampleReport.mileageKm,
      identity: sampleReport.identity,
      reportVersion: 1,
    });
    expect(h2).toBe(h1);

    const tampered = { ...sampleReport, mileageKm: 128_451 };
    expect(await sha256Of(tampered)).not.toBe(h1);
  });
});

describe('verifyContentHash (tamper detection)', () => {
  it('accepts matching content', async () => {
    const hash = await sha256Of(sampleReport);
    const res = await verifyContentHash(sampleReport, hash);
    expect(res.ok).toBe(true);
  });

  it('flags modified content', async () => {
    const hash = await sha256Of(sampleReport);
    const res = await verifyContentHash(
      { ...sampleReport, panels: [{ panel: 'hood', condition: 'replaced' }, sampleReport.panels[1]!] },
      hash,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('mismatch');
  });

  it('flags malformed stored hashes', async () => {
    const res = await verifyContentHash(sampleReport, 'not-a-hash');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('malformed-hash');
    expect(res.expected).toBeNull();
  });

  it('is case/whitespace tolerant on the stored value', async () => {
    const hash = await sha256Of(sampleReport);
    const res = await verifyContentHash(sampleReport, ` ${hash.toUpperCase()} `);
    expect(res.ok).toBe(true);
  });
});
