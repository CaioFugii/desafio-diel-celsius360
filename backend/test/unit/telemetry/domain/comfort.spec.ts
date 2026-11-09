import { classifyComfort } from '../../../../src/telemetry/domain/comfort';

describe('classifyComfort', () => {
  const band = { min: 21, max: 25 };

  it.each([
    [20.9, 'below'],
    [21, 'within'],
    [23.4, 'within'],
    [25, 'within'],
    [25.1, 'above'],
  ] as const)('classifies %p °C as %s', (temperature, expected) => {
    expect(classifyComfort(temperature, band)).toBe(expected);
  });
});
