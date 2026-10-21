import { describe, expect, it } from 'vitest';
import { canonicalize, sha256Of, verifyContentHash } from '../src/index';

/**
 * Version immutability semantics: editing a finalized report creates a NEW
 * version; every old version's content keeps hashing to its original fingerprint.
 */
interface Version {
  version: number;
  content: Record<string, unknown>;
  hash: string;
}

async function saveVersion(content: Record<string, unknown>, version: number): Promise<Version> {
  return { version, content, hash: await sha256Of({ version, content }) };
}

describe('report version immutability', () => {
  it('old versions keep their fingerprint after later edits', async () => {
    const v1 = await saveVersion({ mileageKm: 128_450, notes: 'سالم' }, 1);
    const v2 = await saveVersion({ mileageKm: 128_450, notes: 'تعویض سپر جلو', panels: [] }, 2);

    expect(v2.hash).not.toBe(v1.hash);

    const payload = (v: Version) => ({ version: v.version, content: v.content });

    // Simulated tampering with the stored v1 content:
    const tamperedV1 = { version: 1, content: { ...v1.content, notes: 'بدون ایراد' } };
    const res = await verifyContentHash(tamperedV1, v1.hash);
    expect(res.ok).toBe(false);

    // Untouched v1 still verifies.
    expect((await verifyContentHash(payload(v1), v1.hash)).ok).toBe(true);
    // v2 verifies independently of v1.
    expect((await verifyContentHash(payload(v2), v2.hash)).ok).toBe(true);
  });

  it('version number participates in the hash (replay across versions fails)', async () => {
    const content = { mileageKm: 100 };
    const v1 = await saveVersion(content, 1);
    const v2 = await saveVersion(content, 2);
    expect(v1.hash).not.toBe(v2.hash);
    expect((await verifyContentHash(v1, v2.hash)).ok).toBe(false);
  });

  it('canonical form is stable across serialization round-trips', async () => {
    const content = { panels: [{ panel: 'roof', condition: 'repainted' }], kilometer: 12 };
    const once = canonicalize(content);
    const roundTripped = canonicalize(JSON.parse(once));
    expect(roundTripped).toBe(once);
    expect(await sha256Of(JSON.parse(once))).toBe(await sha256Of(content));
  });
});
