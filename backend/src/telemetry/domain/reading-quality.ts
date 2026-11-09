export type RejectionReason =
  'not_a_number' | 'sensor_error_code' | 'out_of_plausible_range';

export interface ReadingQualityPolicy {
  /** Returns why a reading must be discarded, or null when it is usable. */
  assess(value: unknown): RejectionReason | null;
}

export interface Ds18b20PolicyOptions {
  errorCodes: readonly number[];
  plausibleMin: number;
  plausibleMax: number;
}

/**
 * DS18B20 sensors report -127 °C when disconnected and 85 °C right after a
 * power-on reset. Anything outside an indoor-plausible range is also dropped.
 */
export class Ds18b20QualityPolicy implements ReadingQualityPolicy {
  static readonly DEFAULTS: Ds18b20PolicyOptions = {
    errorCodes: [-127, 85],
    plausibleMin: -10,
    plausibleMax: 60,
  };

  constructor(
    private readonly options: Ds18b20PolicyOptions = Ds18b20QualityPolicy.DEFAULTS,
  ) {}

  assess(value: unknown): RejectionReason | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'not_a_number';
    }
    if (this.options.errorCodes.includes(value)) return 'sensor_error_code';
    if (
      value < this.options.plausibleMin ||
      value > this.options.plausibleMax
    ) {
      return 'out_of_plausible_range';
    }
    return null;
  }
}
