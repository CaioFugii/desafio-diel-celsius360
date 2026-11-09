import { Resolution } from './domain/resolution';

/** Whitelist of continuous aggregates; never interpolate user input into SQL. */
export const ZONE_AGGREGATE: Record<Resolution, string> = {
  '1m': 'telemetry.zone_1m',
  '15m': 'telemetry.zone_15m',
  '1h': 'telemetry.zone_1h',
};
