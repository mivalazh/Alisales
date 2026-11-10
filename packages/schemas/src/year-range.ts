/**
 * Two-way model-year range selection used by the filter popover.
 *
 * The UI has one active bound at a time: choosing «از سال» sets the start and
 * arms «تا سال», then choosing the end closes the range and arms the start
 * again for the next range. Selections are always normalised so `from <= to`;
 * selecting a start beyond the current end swaps the pair instead of producing
 * an empty range.
 */

export type YearRangeBound = 'from' | 'to';

export interface YearRange {
  yearFrom?: number;
  yearTo?: number;
}

export interface YearRangePick {
  range: YearRange;
  activeBound: YearRangeBound;
}

export function pickYearRange(
  current: YearRange,
  year: number,
  activeBound: YearRangeBound,
  bounds: { earliest: number; latest: number },
): YearRangePick {
  const { earliest, latest } = bounds;

  if (activeBound === 'from') {
    // Start a range. Without an explicit end, the latest model year is the
    // display default; if the chosen start is beyond it, the pair swaps.
    const end = current.yearTo ?? latest;
    return {
      range: {
        yearFrom: Math.min(year, end),
        yearTo: Math.max(year, end),
      },
      activeBound: 'to',
    };
  }

  // End a range. Without an explicit start, the earliest selectable year is
  // the default; the same normalisation keeps the interval valid.
  const start = current.yearFrom ?? earliest;
  return {
    range: {
      yearFrom: Math.min(start, year),
      yearTo: Math.max(start, year),
    },
    activeBound: 'from',
  };
}
