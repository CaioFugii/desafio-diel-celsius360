export interface TimeRange {
  from: Date;
  to: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const PERIODS = {
  '1d': DAY_MS,
  '7d': 7 * DAY_MS,
  '30d': 30 * DAY_MS,
} as const;

export type PeriodKey = keyof typeof PERIODS;
export const PERIOD_KEYS = Object.keys(PERIODS) as PeriodKey[];

/** Periods are trailing windows ending at the reference "now". */
export function rangeForPeriod(period: PeriodKey, now: Date): TimeRange {
  return { from: new Date(now.getTime() - PERIODS[period]), to: now };
}

export function spanMs(range: TimeRange): number {
  return range.to.getTime() - range.from.getTime();
}
