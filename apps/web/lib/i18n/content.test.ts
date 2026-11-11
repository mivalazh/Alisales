import { describe, expect, it } from 'vitest';
import { hasPersianText, translateListingContentToEn } from './content';

describe('translateListingContentToEn', () => {
  it('translates seller colour, body and condition phrases', () => {
    expect(translateListingContentToEn('سفید صدفی')).toBe('Pearl white');
    expect(translateListingContentToEn('شاسی‌بلند')).toBe('SUV');
    expect(translateListingContentToEn('بی‌رنگ (فابریک)')).toBe(
      'Factory paint, no repaint',
    );
    expect(translateListingContentToEn('سالم و پلمپ')).toBe(
      'Sealed and undamaged',
    );
  });

  it('turns insurance duration into natural English', () => {
    expect(translateListingContentToEn('دارد (۱۰ ماه اعتبار)')).toBe(
      'Yes (10 months remaining)',
    );
  });

  it('translates mixed free text and normalises digits', () => {
    const value = translateListingContentToEn(
      'خودرو تک‌مالک، بدون رنگ و بدون تصادف، بیمه شخص ثالث دارد (۱۰ ماه اعتبار)',
    );
    expect(value).toBe(
      'Vehicle single owner, no repaint and no accident history, third-party insurance Yes (10 months remaining)',
    );
    expect(hasPersianText(value)).toBe(false);
  });

  it('leaves Latin content intact', () => {
    expect(translateListingContentToEn('Land Cruiser 2022')).toBe('Land Cruiser 2022');
    expect(translateListingContentToEn('')).toBe('');
  });
});
