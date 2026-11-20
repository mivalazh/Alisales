import { NextResponse } from 'next/server';
import { isDataUnavailable } from '../data/unavailable';

/**
 * Convert a data-layer outage into one distinguishable response shape.
 *
 * 503 (not 500) says "the dependency is down, retrying may work"; the body
 * carries a stable code and a Persian message the UI can show as-is, so a
 * client never mistakes an outage for an empty list. `Retry-After` keeps
 * polling clients polite instead of hammering a struggling project.
 */
export const DATA_UNAVAILABLE_MESSAGE =
  'اطلاعات در دسترس نیست؛ دوباره تلاش کنید.';

export function dataUnavailableResponse(error: unknown): NextResponse | null {
  if (!isDataUnavailable(error)) return null;
  return NextResponse.json(
    {
      ok: false,
      code: 'DATA_UNAVAILABLE',
      retryable: true,
      error: DATA_UNAVAILABLE_MESSAGE,
    },
    {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Retry-After': '15',
      },
    },
  );
}
