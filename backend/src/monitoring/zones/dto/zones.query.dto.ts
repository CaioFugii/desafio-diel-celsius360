import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { PERIOD_KEYS, PeriodKey } from '../../../shared/time/time-range';
import { RangeQuery } from '../../domain/zone-range';

export class SeriesQueryDto implements RangeQuery {
  @ApiPropertyOptional({
    enum: PERIOD_KEYS,
    default: '1d',
    description: 'Janela até o "agora"; ignorado quando from/to são enviados',
  })
  @IsOptional()
  @IsIn(PERIOD_KEYS)
  period?: PeriodKey;

  @ApiPropertyOptional({ example: '2026-02-09T00:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ example: '2026-02-10T00:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class SummaryQueryDto {
  @ApiPropertyOptional({ enum: PERIOD_KEYS, default: '1d' })
  @IsOptional()
  @IsIn(PERIOD_KEYS)
  period: PeriodKey = '1d';
}
