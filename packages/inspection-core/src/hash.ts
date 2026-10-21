import { canonicalize } from './canonical';

const HEX64 = /^[0-9a-f]{64}$/;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto SubtleCrypto is unavailable (requires Node 18+ / browser / edge)');
  }
  return subtle;
}

/** SHA-256 of the canonical JSON encoding of any JSON-like value → lowercase hex. */
export async function sha256Of(value: unknown): Promise<string> {
  return sha256HexOfString(canonicalize(value));
}

/** SHA-256 of a UTF-8 string (NFC-normalized) → lowercase hex. */
export async function sha256HexOfString(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input.normalize('NFC'));
  const digest = await getSubtle().digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isSha256Hex(value: string): boolean {
  return HEX64.test(value);
}

export { canonicalize };
