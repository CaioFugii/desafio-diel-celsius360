import { resolutionFor } from './resolution';

const HOUR_MS = 3_600_000;
const rangeOf = (hours: number) => ({
  from: new Date(0),
  to: new Date(hours * HOUR_MS),
});

describe('resolutionFor', () => {
  it.each([
    [24, '1m'],
    [36, '1m'],
    [37, '15m'],
    [7 * 24, '15m'],
    [8 * 24, '15m'],
    [8 * 24 + 1, '1h'],
    [30 * 24, '1h'],
  ] as const)('uses %p hours -> %s', (hours, expected) => {
    expect(resolutionFor(rangeOf(hours))).toBe(expected);
  });
});
