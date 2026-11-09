import { WeeklySchedule } from '../../shared/time/weekly-schedule';
import { ComfortBand } from '../../telemetry/domain/comfort';

/** Everything the enrichment needs to know about where a device is installed. */
export interface ZoneContext {
  zoneId: string;
  band: ComfortBand;
  schedule: WeeklySchedule;
  timeZone: string;
}

export interface ZoneDirectory {
  readonly size: number;
  find(deviceId: string): ZoneContext | undefined;
}

export abstract class ZoneDirectoryLoader {
  abstract load(): Promise<ZoneDirectory>;
}
