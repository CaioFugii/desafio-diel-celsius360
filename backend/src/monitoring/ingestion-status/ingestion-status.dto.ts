import { ApiProperty } from '@nestjs/swagger';
import { IngestionStatus, SourceProgress } from './ingestion-status.read-model';

class SourceProgressDto implements SourceProgress {
  @ApiProperty({ example: 'telemetrias.jsonl' }) source: string;
  @ApiProperty() lastLine: number;
  @ApiProperty({ nullable: true, type: Date }) referenceTime: Date | null;
  @ApiProperty() startedAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({ nullable: true, type: Date }) completedAt: Date | null;
}

class IngestionTotalsDto {
  @ApiProperty() rawPackets: number;
  @ApiProperty() samples: number;
  @ApiProperty() rejectedReadings: number;
  @ApiProperty() invalidLines: number;
}

export class IngestionStatusDto implements IngestionStatus {
  @ApiProperty({ nullable: true, type: Date }) referenceTime: Date | null;
  @ApiProperty({ type: [SourceProgressDto] }) sources: SourceProgressDto[];
  @ApiProperty({ type: IngestionTotalsDto }) totals: IngestionTotalsDto;
  @ApiProperty({ type: [String], example: ['IOT099'] })
  unregisteredDevices: string[];
}
