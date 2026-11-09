export interface TelemetryPacket {
  deviceId: string;
  /** Instant of the last sample (device local time converted with `GMT`). */
  sentAt: Date;
  gmtOffsetHours: number;
  samplingSeconds: number;
  readings: unknown[];
  savedData: boolean;
  payload: Record<string, unknown>;
}

export type PacketParseResult =
  { ok: true; packet: TelemetryPacket } | { ok: false; reason: string };

export interface TimedReading {
  ts: Date;
  value: unknown;
}

const LOCAL_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
const MAX_READINGS = 1_000;

function fail(reason: string): PacketParseResult {
  return { ok: false, reason };
}

function localToUtc(timestamp: string, gmtOffsetHours: number): Date | null {
  const m = LOCAL_TIMESTAMP.exec(timestamp);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = m.slice(1).map(Number);
  const asUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (asUtc.getUTCMonth() !== month - 1 || asUtc.getUTCDate() !== day) {
    return null;
  }
  return new Date(asUtc.getTime() - gmtOffsetHours * 3_600_000);
}

export function parsePacket(line: string): PacketParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(line);
  } catch {
    return fail('invalid_json');
  }
  if (
    typeof payload !== 'object' ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return fail('not_an_object');
  }
  const p = payload as Record<string, unknown>;

  if (typeof p.dev_id !== 'string' || p.dev_id.trim() === '') {
    return fail('missing_dev_id');
  }
  if (typeof p.GMT !== 'number' || p.GMT < -12 || p.GMT > 14) {
    return fail('invalid_gmt');
  }
  if (
    typeof p.samplingTime !== 'number' ||
    !Number.isInteger(p.samplingTime) ||
    p.samplingTime <= 0 ||
    p.samplingTime > 3_600
  ) {
    return fail('invalid_sampling_time');
  }
  if (
    !Array.isArray(p.Temperature) ||
    p.Temperature.length === 0 ||
    p.Temperature.length > MAX_READINGS
  ) {
    return fail('invalid_temperature_list');
  }
  const sentAt =
    typeof p.timestamp === 'string' ? localToUtc(p.timestamp, p.GMT) : null;
  if (!sentAt) return fail('invalid_timestamp');

  return {
    ok: true,
    packet: {
      deviceId: p.dev_id.trim(),
      sentAt,
      gmtOffsetHours: p.GMT,
      samplingSeconds: p.samplingTime,
      readings: p.Temperature,
      savedData: p.saved_data === true,
      payload: p,
    },
  };
}

/** The packet timestamp belongs to the last reading; earlier ones step back by samplingTime. */
export function timedReadings(packet: TelemetryPacket): TimedReading[] {
  const last = packet.readings.length - 1;
  const stepMs = packet.samplingSeconds * 1_000;
  return packet.readings.map((value, i) => ({
    ts: new Date(packet.sentAt.getTime() - (last - i) * stepMs),
    value,
  }));
}
