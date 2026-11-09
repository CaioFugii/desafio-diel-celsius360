import { BadRequestException } from '@nestjs/common';
import {
  PeriodKey,
  TimeRange,
  rangeForPeriod,
  spanMs,
} from '../../shared/time/time-range';

export interface RangeQuery {
  period?: PeriodKey;
  from?: Date;
  to?: Date;
}

export const MAX_RANGE_MS = 92 * 24 * 3_600_000;

/** An explicit from/to wins over a period; the default is the last day. */
export function resolveRange(query: RangeQuery, now: Date): TimeRange {
  if (query.from === undefined && query.to === undefined) {
    return rangeForPeriod(query.period ?? '1d', now);
  }
  if (query.from === undefined || query.to === undefined) {
    throw new BadRequestException('from e to devem ser enviados juntos');
  }
  const range = { from: query.from, to: query.to };
  if (spanMs(range) <= 0)
    throw new BadRequestException('from deve ser anterior a to');
  if (spanMs(range) > MAX_RANGE_MS) {
    throw new BadRequestException('o intervalo não pode passar de 92 dias');
  }
  return range;
}
