import {
  ComfortBand,
  ComfortLevel,
  classifyComfort,
} from '../../telemetry/domain/comfort';

export const DEVICE_STATUSES = ['online', 'offline', 'no_data'] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

/**
 * Devices send a packet every 6 minutes. Fifteen minutes tolerates one lost
 * packet (a 12-minute gap is common in the data) without flapping to offline.
 */
export const OFFLINE_AFTER_MS = 15 * 60_000;

export function deviceStatus(
  lastPacketAt: Date | null,
  now: Date,
  offlineAfterMs = OFFLINE_AFTER_MS,
): DeviceStatus {
  if (!lastPacketAt) return 'no_data';
  return now.getTime() - lastPacketAt.getTime() <= offlineAfterMs
    ? 'online'
    : 'offline';
}

/** What the zone looks like right now, from the user's point of view. */
export const ZONE_CONDITIONS = [
  'below',
  'within',
  'above',
  'closed',
  'unknown',
] as const;
export type ZoneCondition = ComfortLevel | 'closed' | 'unknown';

export interface ZoneConditionInput {
  deviceStatus: DeviceStatus;
  isOpen: boolean;
  lastTemperature: number | null;
  band: ComfortBand;
}

export function zoneCondition(input: ZoneConditionInput): ZoneCondition {
  if (input.deviceStatus !== 'online' || input.lastTemperature === null) {
    return 'unknown';
  }
  if (!input.isOpen) return 'closed';
  return classifyComfort(input.lastTemperature, input.band);
}

export function isOutOfRange(condition: ZoneCondition): boolean {
  return condition === 'below' || condition === 'above';
}

export const STORE_STATUSES = [
  'online',
  'partial',
  'offline',
  'no_data',
] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

/** Worst first, used to sort the network by status. */
export const STORE_STATUS_SEVERITY: Record<StoreStatus, number> = {
  offline: 0,
  partial: 1,
  no_data: 2,
  online: 3,
};

export function storeStatus(devices: readonly DeviceStatus[]): StoreStatus {
  const reporting = devices.filter((s) => s !== 'no_data');
  if (reporting.length === 0) return 'no_data';
  const online = reporting.filter((s) => s === 'online').length;
  if (online === devices.length) return 'online';
  if (online === 0) return 'offline';
  return 'partial';
}

/** Percentage rounded to one decimal, or null when there is nothing to measure. */
export function percentage(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1_000) / 10;
}
