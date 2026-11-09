import { ComfortLevel } from '../../telemetry/domain/comfort';
import { RejectionReason } from '../../telemetry/domain/reading-quality';
import { TelemetryPacket } from '../../telemetry/domain/telemetry-packet';

export interface EnrichedSample {
  ts: Date;
  deviceId: string;
  zoneId: string;
  temperature: number;
  businessHours: boolean;
  comfort: ComfortLevel;
}

export interface RejectedSample {
  ts: Date;
  deviceId: string;
  temperature: number | null;
  reason: RejectionReason;
}

export interface EnrichedPacket {
  packet: TelemetryPacket;
  /** null when the device is not in the registry: raw is kept, series is not. */
  zoneId: string | null;
  samples: EnrichedSample[];
  rejected: RejectedSample[];
}
