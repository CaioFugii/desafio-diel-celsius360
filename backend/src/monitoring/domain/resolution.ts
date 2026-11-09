import { TimeRange, spanMs } from '../../shared/time/time-range';

export type Resolution = '1m' | '15m' | '1h';

export const RESOLUTION_SECONDS: Record<Resolution, number> = {
  '1m': 60,
  '15m': 900,
  '1h': 3_600,
};

const HOUR_MS = 3_600_000;

/** Keeps every chart under ~2.2k points: 1 day ≈ 1440, 7 days ≈ 672, 30 days ≈ 720. */
export function resolutionFor(range: TimeRange): Resolution {
  const span = spanMs(range);
  if (span <= 36 * HOUR_MS) return '1m';
  if (span <= 8 * 24 * HOUR_MS) return '15m';
  return '1h';
}
