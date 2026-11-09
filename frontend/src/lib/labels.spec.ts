import { comfortTone } from './labels';

describe('comfortTone', () => {
  it.each([
    [null, 'neutral'],
    [100, 'success'],
    [90, 'success'],
    [89.9, 'warning'],
    [75, 'warning'],
    [74.9, 'danger'],
    [0, 'danger'],
  ] as const)('%p → %s', (pct, tone) => {
    expect(comfortTone(pct)).toBe(tone);
  });
});
