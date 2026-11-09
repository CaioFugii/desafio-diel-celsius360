import { Ds18b20QualityPolicy } from './reading-quality';

describe('Ds18b20QualityPolicy', () => {
  const policy = new Ds18b20QualityPolicy();

  it('accepts plausible indoor temperatures', () => {
    expect(policy.assess(23.5)).toBeNull();
    expect(policy.assess(-10)).toBeNull();
    expect(policy.assess(60)).toBeNull();
  });

  it('rejects the sensor error codes', () => {
    expect(policy.assess(-127)).toBe('sensor_error_code');
    expect(policy.assess(85)).toBe('sensor_error_code');
  });

  it('rejects values outside the plausible range', () => {
    expect(policy.assess(-10.1)).toBe('out_of_plausible_range');
    expect(policy.assess(70)).toBe('out_of_plausible_range');
  });

  it('rejects anything that is not a finite number', () => {
    expect(policy.assess(null)).toBe('not_a_number');
    expect(policy.assess('23.5')).toBe('not_a_number');
    expect(policy.assess(Number.NaN)).toBe('not_a_number');
  });

  it('accepts custom limits', () => {
    const strict = new Ds18b20QualityPolicy({
      errorCodes: [],
      plausibleMin: 0,
      plausibleMax: 50,
    });

    expect(strict.assess(85)).toBe('out_of_plausible_range');
    expect(strict.assess(-1)).toBe('out_of_plausible_range');
  });
});
