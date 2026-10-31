import { describe, expect, it } from 'vitest';
import { ACCOUNT_TYPE_LABELS, accountTypeLabel, profileSchema } from '../src/profile';

describe('account types', () => {
  it('has exactly two labels, فردی and نمایشگاه', () => {
    expect(ACCOUNT_TYPE_LABELS).toEqual({ individual: 'فردی', showroom: 'نمایشگاه' });
    expect(accountTypeLabel('individual')).toBe('فردی');
    expect(accountTypeLabel('showroom')).toBe('نمایشگاه');
  });
});

describe('profileSchema', () => {
  it('trims the display name', () => {
    const parsed = profileSchema.parse({ displayName: '  علی رضایی  ', accountType: 'individual' });
    expect(parsed.displayName).toBe('علی رضایی');
  });

  it('accepts a showroom account', () => {
    expect(profileSchema.parse({ displayName: 'نمایشگاه کیش', accountType: 'showroom' }).accountType).toBe(
      'showroom',
    );
  });

  it('rejects names shorter than two characters', () => {
    expect(profileSchema.safeParse({ displayName: ' ع ', accountType: 'individual' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: '', accountType: 'individual' }).success).toBe(false);
  });

  it('rejects names longer than sixty characters', () => {
    expect(
      profileSchema.safeParse({ displayName: 'x'.repeat(61), accountType: 'individual' }).success,
    ).toBe(false);
  });

  it('rejects any account type outside فردی / نمایشگاه', () => {
    expect(profileSchema.safeParse({ displayName: 'علی', accountType: 'seller' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'علی', accountType: 'buyer' }).success).toBe(false);
  });
});
