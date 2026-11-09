import { LocalTimeResolver } from '../../shared/time/local-time';
import { WeeklyHours, WeeklySchedule } from '../../shared/time/weekly-schedule';
import { ComfortBand } from '../../telemetry/domain/comfort';
import {
  DeviceStatus,
  OFFLINE_AFTER_MS,
  ZoneCondition,
  deviceStatus,
  zoneCondition,
} from './status';

export interface ZoneLiveFacts {
  deviceId: string | null;
  band: ComfortBand;
  businessHours: WeeklyHours;
  lastPacketAt: Date | null;
  lastSampleAt: Date | null;
  lastTemperature: number | null;
}

export interface ZoneLiveState {
  deviceStatus: DeviceStatus;
  isOpen: boolean;
  condition: ZoneCondition;
  /** null when the last valid reading is older than the offline threshold. */
  currentTemperature: number | null;
}

/**
 * Current state of a zone at the reference "now". A device can be online while
 * its sensor only sends error codes: the stale temperature is not used then.
 */
export class ZoneEvaluator {
  constructor(private readonly localTime: LocalTimeResolver) {}

  evaluate(facts: ZoneLiveFacts, timeZone: string, now: Date): ZoneLiveState {
    const status = facts.deviceId
      ? deviceStatus(facts.lastPacketAt, now)
      : 'no_data';
    const local = this.localTime.resolve(now, timeZone);
    const isOpen = WeeklySchedule.from(facts.businessHours).isOpen(
      local.weekday,
      local.minuteOfDay,
    );
    const fresh =
      facts.lastSampleAt !== null &&
      now.getTime() - facts.lastSampleAt.getTime() <= OFFLINE_AFTER_MS;
    const currentTemperature = fresh ? facts.lastTemperature : null;
    return {
      deviceStatus: status,
      isOpen,
      currentTemperature,
      condition: zoneCondition({
        deviceStatus: status,
        isOpen,
        lastTemperature: currentTemperature,
        band: facts.band,
      }),
    };
  }
}
