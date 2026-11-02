/**
 * Local catalogue art (`public/covers/**`) ships pre-sized WebP thumbs and full
 * frames, so it is served as-is instead of through the Next image optimizer.
 * Remote storage photos keep the optimizer.
 */
export function isPreSizedSource(url: string | null | undefined): boolean {
  return !url || url.startsWith('/covers/');
}
