import { PeriodKey } from '../../api/types';

const PERIOD_KEYS: readonly PeriodKey[] = ['1d', '7d', '30d'];

export const DEFAULT_ZONE_PERIOD: PeriodKey = '1d';

export function parsePeriod(value: string | null): PeriodKey {
  return PERIOD_KEYS.find((p) => p === value) ?? DEFAULT_ZONE_PERIOD;
}
