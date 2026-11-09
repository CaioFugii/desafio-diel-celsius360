import {
  WeeklyHours,
  WeeklySchedule,
} from '../../../src/shared/time/weekly-schedule';
import { TelemetryPacket } from '../../../src/telemetry/domain/telemetry-packet';
import { MapZoneDirectory } from '../../../src/ingestion/repositories/map-zone-directory';
import { ZoneContext } from '../../../src/ingestion/interfaces/zone-directory.interface';

export const STORE_HOURS: WeeklyHours = {
  sun: null,
  mon: { open: '09:00', close: '20:00' },
  tue: { open: '09:00', close: '20:00' },
  wed: { open: '09:00', close: '20:00' },
  thu: { open: '09:00', close: '20:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '18:00' },
};

export function zoneContext(overrides: Partial<ZoneContext> = {}): ZoneContext {
  return {
    zoneId: 'AMB-001',
    band: { min: 21, max: 25 },
    schedule: WeeklySchedule.from(STORE_HOURS),
    timeZone: 'America/Sao_Paulo',
    ...overrides,
  };
}

export function directoryOf(
  entries: Record<string, ZoneContext>,
): MapZoneDirectory {
  return new MapZoneDirectory(new Map(Object.entries(entries)));
}

export function packet(
  overrides: Partial<TelemetryPacket> = {},
): TelemetryPacket {
  return {
    deviceId: 'IOT001',
    sentAt: new Date('2026-01-12T12:00:00Z'),
    gmtOffsetHours: -3,
    samplingSeconds: 30,
    readings: [22],
    savedData: false,
    payload: {},
    ...overrides,
  };
}

export function packetLine(
  deviceId: string,
  localTimestamp: string,
  readings: unknown[],
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    dev_id: deviceId,
    timestamp: localTimestamp,
    GMT: -3,
    samplingTime: 30,
    Temperature: readings,
    ...extra,
  });
}
