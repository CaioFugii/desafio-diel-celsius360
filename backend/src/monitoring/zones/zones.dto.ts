import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { PERIOD_KEYS, PeriodKey } from '../../shared/time/time-range';
import { Resolution } from '../domain/resolution';
import {
  DEVICE_STATUSES,
  DeviceStatus,
  ZONE_CONDITIONS,
  ZoneCondition,
} from '../domain/status';
import {
  ComfortBandDto,
  PeriodDto,
  RefDto,
  WeeklyHoursDto,
} from '../common.dto';
import { ZoneIndicators, ZoneSummary } from './zone-summary.service';
import { ZoneSeries } from './zone-series.service';
import { RangeQuery } from './zone-range';
import { Gap, SeriesPoint } from './zones.read-model';

const RESOLUTIONS: Resolution[] = ['1m', '15m', '1h'];

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

export class SeriesPointDto implements SeriesPoint {
  @ApiProperty({ description: 'Início do bucket' }) t: Date;
  @ApiProperty() avg: number;
  @ApiProperty() min: number;
  @ApiProperty() max: number;
  @ApiProperty({ description: 'Leituras válidas no bucket' }) samples: number;
}

export class GapDto implements Gap {
  @ApiProperty() from: Date;
  @ApiProperty() to: Date;
}

export class ZoneSeriesDto implements ZoneSeries {
  @ApiProperty() zoneId: string;
  @ApiProperty() from: Date;
  @ApiProperty() to: Date;

  @ApiProperty({
    enum: RESOLUTIONS,
    description:
      'Escolhida pelo tamanho do intervalo: até 36 h = 1m, até 8 dias = 15m, acima = 1h',
  })
  resolution: Resolution;

  @ApiProperty() bucketSeconds: number;
  @ApiProperty({ type: ComfortBandDto }) comfortBand: ComfortBandDto;
  @ApiProperty({ type: [SeriesPointDto] }) points: SeriesPointDto[];

  @ApiProperty({
    type: [GapDto],
    description: 'Intervalos de 15 min ou mais sem leitura válida',
  })
  gaps: GapDto[];
}

class ZoneInfoDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ type: ComfortBandDto }) comfortBand: ComfortBandDto;
  @ApiProperty({ type: WeeklyHoursDto }) businessHours: WeeklyHoursDto;
}

class StoreInfoDto extends RefDto {
  @ApiProperty() city: string;
  @ApiProperty() state: string;
  @ApiProperty() timezone: string;
}

class DeviceInfoDto {
  @ApiProperty({ nullable: true, type: String }) id: string | null;
  @ApiProperty({ enum: DEVICE_STATUSES }) status: DeviceStatus;
  @ApiProperty({ nullable: true, type: Date }) lastPacketAt: Date | null;
}

class CurrentReadingDto {
  @ApiProperty({ nullable: true, type: Number }) temperature: number | null;
  @ApiProperty({ nullable: true, type: Date }) readingAt: Date | null;
  @ApiProperty({ enum: ZONE_CONDITIONS }) condition: ZoneCondition;
  @ApiProperty() isOpen: boolean;
}

class SummaryPeriodDto extends PeriodDto {
  @ApiProperty({ enum: RESOLUTIONS }) resolution: Resolution;
}

class ZoneIndicatorsDto implements ZoneIndicators {
  @ApiProperty({
    nullable: true,
    type: Number,
    description: '% no horário de funcionamento dentro da faixa',
  })
  comfortPct: number | null;

  @ApiProperty({ nullable: true, type: Number }) belowPct: number | null;
  @ApiProperty({ nullable: true, type: Number }) abovePct: number | null;
  @ApiProperty() businessHoursSamples: number;
  @ApiProperty({ nullable: true, type: Number }) avgTemperature: number | null;
  @ApiProperty({ nullable: true, type: Number }) minTemperature: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxTemperature: number | null;
  @ApiProperty({
    description: '% do período sem lacunas de 15 min ou mais',
  })
  availabilityPct: number;
  @ApiProperty() gaps: number;
  @ApiProperty() gapMinutes: number;
  @ApiProperty({
    description: 'Leituras descartadas (códigos de erro, fora da faixa física)',
  })
  rejectedReadings: number;
}

export class ZoneSummaryDto implements ZoneSummary {
  @ApiProperty() referenceTime: Date;
  @ApiProperty({ type: ZoneInfoDto }) zone: ZoneInfoDto;
  @ApiProperty({ type: StoreInfoDto }) store: StoreInfoDto;
  @ApiProperty({ type: RefDto }) customer: RefDto;
  @ApiProperty({ type: DeviceInfoDto }) device: DeviceInfoDto;
  @ApiProperty({ type: CurrentReadingDto }) current: CurrentReadingDto;
  @ApiProperty({ type: SummaryPeriodDto }) period: SummaryPeriodDto;
  @ApiProperty({ type: ZoneIndicatorsDto }) indicators: ZoneIndicatorsDto;
}
