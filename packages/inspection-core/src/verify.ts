import { canonicalize } from './canonical';
import { isSha256Hex, sha256HexOfString } from './hash';

export interface VerificationResult {
  ok: boolean;
  /** Recomputed hash (lowercase hex), always present. */
  computed: string;
  /** Normalized expected hash, or null when the stored value is malformed. */
  expected: string | null;
  reason?: 'malformed-hash' | 'mismatch';
}

/**
 * Recompute the SHA-256 of `content` and compare with a stored fingerprint.
 * Used by the public report page to detect tampering.
 */
export async function verifyContentHash(
  content: unknown,
  storedHash: string,
): Promise<VerificationResult> {
  const computed = await sha256HexOfString(canonicalize(content));
  const normalized = storedHash.trim().toLowerCase();
  if (!isSha256Hex(normalized)) {
    return { ok: false, computed, expected: null, reason: 'malformed-hash' };
  }
  if (computed !== normalized) {
    return { ok: false, computed, expected: normalized, reason: 'mismatch' };
  }
  return { ok: true, computed, expected: normalized };
}
