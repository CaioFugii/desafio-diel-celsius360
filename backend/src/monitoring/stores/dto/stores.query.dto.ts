import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PERIOD_KEYS, PeriodKey } from '../../../shared/time/time-range';
import { STORE_STATUSES, StoreStatus } from '../../domain/status';
import {
  STORE_SORT_KEYS,
  StoreListQuery,
  StoreSortKey,
} from '../interfaces/network.interface';

export class StoreListQueryDto implements StoreListQuery {
  @ApiPropertyOptional({
    enum: PERIOD_KEYS,
    default: '7d',
    description: 'Período dos indicadores',
  })
  @IsOptional()
  @IsIn(PERIOD_KEYS)
  period: PeriodKey = '7d';

  @ApiPropertyOptional({ example: 'CLI-001' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Busca por id, nome ou cidade da loja',
    example: 'paulista',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: STORE_STATUSES })
  @IsOptional()
  @IsIn(STORE_STATUSES)
  status?: StoreStatus;

  @ApiPropertyOptional({ enum: STORE_SORT_KEYS, default: 'name' })
  @IsOptional()
  @IsIn(STORE_SORT_KEYS)
  sort: StoreSortKey = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
