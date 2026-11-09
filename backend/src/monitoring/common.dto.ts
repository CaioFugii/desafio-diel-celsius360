import { ApiProperty } from '@nestjs/swagger';
import { PERIOD_KEYS, PeriodKey } from '../shared/time/time-range';

export class ComfortBandDto {
  @ApiProperty({ example: 21 })
  min: number;

  @ApiProperty({ example: 25 })
  max: number;
}

export class RefDto {
  @ApiProperty({ example: 'CLI-001' })
  id: string;

  @ApiProperty({ example: 'Moda Carioca' })
  name: string;
}

export class PeriodDto {
  @ApiProperty({ enum: PERIOD_KEYS })
  key: PeriodKey;

  @ApiProperty()
  from: Date;

  @ApiProperty()
  to: Date;
}

export class DailyWindowDto {
  @ApiProperty({ example: '09:00' })
  open: string;

  @ApiProperty({
    example: '20:00',
    description: '"24:00" means until midnight',
  })
  close: string;
}

export class WeeklyHoursDto {
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  sun: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  mon: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  tue: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  wed: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  thu: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  fri: DailyWindowDto | null;
  @ApiProperty({ type: DailyWindowDto, nullable: true })
  sat: DailyWindowDto | null;
}
