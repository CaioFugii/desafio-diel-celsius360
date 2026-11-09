import { rangeForPeriod, spanMs } from './time-range';

describe('rangeForPeriod', () => {
  const now = new Date('2026-02-10T23:59:56Z');

  it.each([
    ['1d', 1],
    ['7d', 7],
    ['30d', 30],
  ] as const)('builds a trailing %s window ending now', (period, days) => {
    const range = rangeForPeriod(period, now);

    expect(range.to).toEqual(now);
    expect(spanMs(range)).toBe(days * 24 * 3_600_000);
  });
});
