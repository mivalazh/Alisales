import { describe, expect, it } from 'vitest';
import { pickYearRange } from '../src/year-range';

const bounds = { earliest: 1995, latest: 2026 };

describe('pickYearRange', () => {
  it('starts a range at the chosen year and arms the end bound', () => {
    expect(pickYearRange({}, 2018, 'from', bounds)).toEqual({
      range: { yearFrom: 2018, yearTo: 2026 },
      activeBound: 'to',
    });
  });

  it('closes an open range and arms the start bound again', () => {
    expect(pickYearRange({ yearFrom: 2018 }, 2022, 'to', bounds)).toEqual({
      range: { yearFrom: 2018, yearTo: 2022 },
      activeBound: 'from',
    });
  });

  it('normalises a start beyond the current end by swapping the pair', () => {
    expect(pickYearRange({ yearFrom: 2018, yearTo: 2020 }, 2024, 'from', bounds)).toEqual({
      range: { yearFrom: 2020, yearTo: 2024 },
      activeBound: 'to',
    });
  });

  it('normalises an end before the current start', () => {
    expect(pickYearRange({ yearFrom: 2020, yearTo: 2026 }, 2016, 'to', bounds)).toEqual({
      range: { yearFrom: 2016, yearTo: 2020 },
      activeBound: 'from',
    });
  });

  it('uses the earliest year when an end is chosen before a start', () => {
    expect(pickYearRange({}, 2018, 'to', bounds)).toEqual({
      range: { yearFrom: 1995, yearTo: 2018 },
      activeBound: 'from',
    });
  });
});
