export interface ComfortBand {
  min: number;
  max: number;
}

export type ComfortLevel = 'below' | 'within' | 'above';

/** Persisted as smallint so continuous aggregates can count by sign. */
export const COMFORT_CODE: Record<ComfortLevel, -1 | 0 | 1> = {
  below: -1,
  within: 0,
  above: 1,
};

/** Band limits are inclusive: 25.0 °C is still comfortable in a 21-25 °C band. */
export function classifyComfort(
  temperature: number,
  band: ComfortBand,
): ComfortLevel {
  if (temperature < band.min) return 'below';
  if (temperature > band.max) return 'above';
  return 'within';
}
