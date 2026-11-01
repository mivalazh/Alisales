/**
 * Event-recording rules for owner statistics (server side, pure).
 *
 * - A view is recorded once per (listing, viewer): the DB has the unique key,
 *   and fixture mode deduplicates, so repeat opens never inflate «بازدید».
 * - The owner's own visit is never a view: posting age/statistics must not be
 *   influenced by the seller refreshing their own page.
 * - A phone reveal is append-only (every tap is a separate contact).
 */
export function shouldRecordView(
  viewerId: string | null | undefined,
  sellerId: string,
): boolean {
  return Boolean(viewerId) && viewerId !== sellerId;
}
