import {
  changeBetween,
  easeOutCubic,
  formatChange,
  formatValue,
  interpolate,
  isDisplayChange,
  roundTo,
} from './value-change';

describe('roundTo', () => {
  it('rounds to the given number of decimals', () => {
    expect(roundTo(21.26, 1)).toBe(21.3);
    expect(roundTo(2.5, 0)).toBe(3);
  });
});

describe('isDisplayChange', () => {
  it('compares values at display precision', () => {
    expect(isDisplayChange(21.21, 21.24, 'temperature')).toBe(false);
    expect(isDisplayChange(21.24, 21.26, 'temperature')).toBe(true);
    expect(isDisplayChange(3, 3.2, 'count')).toBe(false);
  });

  it('treats a value appearing or disappearing as a change', () => {
    expect(isDisplayChange(null, 21, 'temperature')).toBe(true);
    expect(isDisplayChange(21, null, 'temperature')).toBe(true);
    expect(isDisplayChange(null, null, 'temperature')).toBe(false);
  });
});

describe('changeBetween', () => {
  it('measures the change between the displayed values', () => {
    expect(changeBetween(21.2, 21.3, 'temperature')).toEqual({ delta: 0.1, direction: 'up' });
    expect(changeBetween(95.44, 94.16, 'percent')).toEqual({ delta: -1.2, direction: 'down' });
    expect(changeBetween(2, 5, 'count')).toEqual({ delta: 3, direction: 'up' });
  });

  it('reports nothing when there is no previous value or nothing moved on screen', () => {
    expect(changeBetween(null, 21, 'temperature')).toBeNull();
    expect(changeBetween(21, null, 'temperature')).toBeNull();
    expect(changeBetween(21.21, 21.24, 'temperature')).toBeNull();
  });
});

describe('formatValue', () => {
  it('formats each kind in pt-BR', () => {
    expect(formatValue(21.26, 'temperature')).toBe('21,3 °C');
    expect(formatValue(87.25, 'percent')).toBe('87,3%');
    expect(formatValue(1234.4, 'count')).toBe('1.234');
    expect(formatValue(null, 'count')).toBe('—');
  });
});

describe('formatChange', () => {
  it('shows the magnitude with the unit of each kind', () => {
    expect(formatChange(-0.3, 'temperature')).toBe('0,3 °C');
    expect(formatChange(1, 'percent')).toBe('1,0 p.p.');
    expect(formatChange(-2, 'count')).toBe('2');
  });
});

describe('easing', () => {
  it('starts and ends at the endpoints, decelerating on the way', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    expect(interpolate(20, 22, 0.25)).toBe(20.5);
  });
});
