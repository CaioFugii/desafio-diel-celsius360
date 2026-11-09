import { PeriodKey } from '../../../shared/time/time-range';
import { WeeklyHours } from '../../../shared/time/weekly-schedule';
import { ComfortBand } from '../../../telemetry/domain/comfort';
import { Resolution } from '../../domain/resolution';
import { DeviceStatus, ZoneCondition } from '../../domain/status';
import { ZoneDetails } from './zones-read-model.interface';

export interface ZoneIndicators {
  comfortPct: number | null;
  belowPct: number | null;
  abovePct: number | null;
  businessHoursSamples: number;
  avgTemperature: number | null;
  minTemperature: number | null;
  maxTemperature: number | null;
  availabilityPct: number;
  gaps: number;
  gapMinutes: number;
  rejectedReadings: number;
}

export interface ZoneSummary {
  referenceTime: Date;
  zone: {
    id: string;
    name: string;
    comfortBand: ComfortBand;
    businessHours: WeeklyHours;
  };
  store: ZoneDetails['store'];
  customer: ZoneDetails['customer'];
  device: {
    id: string | null;
    status: DeviceStatus;
    lastPacketAt: Date | null;
  };
  current: {
    temperature: number | null;
    readingAt: Date | null;
    condition: ZoneCondition;
    isOpen: boolean;
  };
  period: { key: PeriodKey; from: Date; to: Date; resolution: Resolution };
  indicators: ZoneIndicators;
}
