import { BatchPacket } from '../interfaces/ingestion-store.interface';

export interface DeviceStateUpdate {
  deviceId: string;
  firstPacketAt: Date;
  lastPacketAt: Date;
  lastSampleAt: Date | null;
  lastTemperature: number | null;
}

/**
 * Folds a batch into one update per device. Uses instants, not arrival order,
 * so late packets (saved_data) never move the "last seen" backwards.
 */
export function summarizeDevices(
  packets: readonly BatchPacket[],
): DeviceStateUpdate[] {
  const byDevice = new Map<string, DeviceStateUpdate>();
  for (const { enriched } of packets) {
    const { deviceId, sentAt } = enriched.packet;
    const state = byDevice.get(deviceId) ?? {
      deviceId,
      firstPacketAt: sentAt,
      lastPacketAt: sentAt,
      lastSampleAt: null,
      lastTemperature: null,
    };
    if (sentAt < state.firstPacketAt) state.firstPacketAt = sentAt;
    if (sentAt > state.lastPacketAt) state.lastPacketAt = sentAt;
    for (const sample of enriched.samples) {
      if (!state.lastSampleAt || sample.ts > state.lastSampleAt) {
        state.lastSampleAt = sample.ts;
        state.lastTemperature = sample.temperature;
      }
    }
    byDevice.set(deviceId, state);
  }
  return [...byDevice.values()];
}

export function latestPacketAt(packets: readonly BatchPacket[]): Date | null {
  let latest: Date | null = null;
  for (const { enriched } of packets) {
    if (!latest || enriched.packet.sentAt > latest)
      latest = enriched.packet.sentAt;
  }
  return latest;
}
