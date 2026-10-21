/**
 * Deterministic JSON canonicalization for inspection-report hashing.
 *
 * Rules (order-independent for object keys, order-sensitive for arrays):
 *  - object keys sorted by UTF-16 code units, recursively
 *  - strings (and keys) normalized to Unicode NFC
 *  - `undefined` object properties dropped (JSON semantics)
 *  - `-0` normalized to `0`; non-finite numbers rejected
 *  - Dates serialized as ISO-8601 UTC
 *
 * Same logical content ⇒ byte-identical canonical string ⇒ same SHA-256.
 */
export class CanonicalizationError extends Error {}

export function canonicalize(value: unknown): string {
  const out = write(value, '$');
  if (out === undefined) {
    throw new CanonicalizationError('top-level value must be JSON-representable');
  }
  return out;
}

function write(value: unknown, path: string): string | undefined {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(`non-finite number at ${path}`);
      }
      return JSON.stringify(Object.is(value, -0) ? 0 : value);
    }
    case 'string':
      return JSON.stringify(value.normalize('NFC'));
    case 'bigint':
      throw new CanonicalizationError(`bigint is not JSON-representable at ${path}`);
    case 'undefined':
      return undefined;
    case 'object':
      break;
    default:
      throw new CanonicalizationError(`unsupported type ${typeof value} at ${path}`);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new CanonicalizationError(`invalid Date at ${path}`);
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    const items = value.map((v, i) => write(v, `${path}[${i}]`) ?? 'null');
    return `[${items.join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .map((k) => k.normalize('NFC'))
    .sort();

  const parts: string[] = [];
  for (const key of keys) {
    const encoded = write(record[key], `${path}.${key}`);
    if (encoded === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${encoded}`);
  }
  return `{${parts.join(',')}}`;
}
