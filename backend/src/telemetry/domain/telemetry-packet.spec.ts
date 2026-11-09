import { parsePacket, timedReadings } from './telemetry-packet';

const line = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    dev_id: 'IOT005',
    timestamp: '2026-01-12T00:05:31',
    GMT: -3,
    samplingTime: 30,
    Temperature: [25.7, 25.8, 25.9],
    ...overrides,
  });

describe('parsePacket', () => {
  it('parses a packet and converts the local timestamp to UTC', () => {
    const result = parsePacket(line());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.packet).toMatchObject({
      deviceId: 'IOT005',
      sentAt: new Date('2026-01-12T03:05:31Z'),
      gmtOffsetHours: -3,
      samplingSeconds: 30,
      readings: [25.7, 25.8, 25.9],
      savedData: false,
    });
  });

  it('flags packets that were stored on the device and sent later', () => {
    const result = parsePacket(line({ saved_data: true }));

    expect(result.ok && result.packet.savedData).toBe(true);
  });

  it.each([
    ['not json', 'invalid_json'],
    ['[1,2]', 'not_an_object'],
    [line({ dev_id: '' }), 'missing_dev_id'],
    [line({ GMT: 'x' }), 'invalid_gmt'],
    [line({ GMT: 20 }), 'invalid_gmt'],
    [line({ samplingTime: 0 }), 'invalid_sampling_time'],
    [line({ samplingTime: 1.5 }), 'invalid_sampling_time'],
    [line({ Temperature: [] }), 'invalid_temperature_list'],
    [line({ Temperature: 'x' }), 'invalid_temperature_list'],
    [line({ timestamp: '2026-01-12 00:05:31' }), 'invalid_timestamp'],
    [line({ timestamp: '2026-02-30T00:05:31' }), 'invalid_timestamp'],
    [line({ timestamp: '2026-13-01T00:05:31' }), 'invalid_timestamp'],
    [line({ timestamp: '2026-01-12T24:00:00' }), 'invalid_timestamp'],
  ])('rejects %s with %s', (input, reason) => {
    expect(parsePacket(input)).toEqual({ ok: false, reason });
  });
});

describe('timedReadings', () => {
  it('anchors the last reading at the packet timestamp and steps back by samplingTime', () => {
    const result = parsePacket(line());
    if (!result.ok) throw new Error('fixture should parse');

    expect(timedReadings(result.packet)).toEqual([
      { ts: new Date('2026-01-12T03:04:31Z'), value: 25.7 },
      { ts: new Date('2026-01-12T03:05:01Z'), value: 25.8 },
      { ts: new Date('2026-01-12T03:05:31Z'), value: 25.9 },
    ]);
  });
});
