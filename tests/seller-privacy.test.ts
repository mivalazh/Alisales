import { describe, expect, it } from 'vitest';
import sitemap from '../apps/web/app/sitemap';
import {
  isPublicSellerProfile,
  resolveSellerProfileMode,
} from '../apps/web/lib/seller-visibility';

describe('seller profile visibility', () => {
  it('trusts a saved business/personal choice over legacy showroom flags', () => {
    expect(resolveSellerProfileMode('business', 'individual', [])).toBe('business');
    expect(
      resolveSellerProfileMode('personal', 'showroom', [
        { showroomName: 'Legacy showroom', showroomVerified: true },
      ]),
    ).toBe('personal');
  });

  it('falls back to the account type and then verified inventory', () => {
    expect(resolveSellerProfileMode(null, 'showroom')).toBe('business');
    expect(
      resolveSellerProfileMode(null, null, [{ showroomName: null, showroomVerified: true }]),
    ).toBe('business');
    expect(
      resolveSellerProfileMode(null, null, [
        { showroomName: null, showroomVerified: false },
      ]),
    ).toBe('personal');
    expect(resolveSellerProfileMode(null, null)).toBe('personal');
  });

  it('only exposes the business mode as public', () => {
    expect(isPublicSellerProfile('business')).toBe(true);
    expect(isPublicSellerProfile('personal')).toBe(false);
  });

  it('never publishes seller-profile URLs in the sitemap', async () => {
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.includes('/seller/'))).toBe(false);
    expect(entries.some((entry) => entry.url.includes('/listing/'))).toBe(true);
  });
});
