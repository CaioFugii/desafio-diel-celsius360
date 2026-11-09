import { latestPacketAt, summarizeDevices } from './device-state';
import { BatchPacket } from './ingestion.store';
import { EnrichedSample } from './packet-enricher';
import { packet } from './testing/fixtures';

function batchPacket(
  deviceId: string,
  sentAt: string,
  samples: Array<[string, number]> = [],
): BatchPacket {
  return {
    lineNo: 1,
    text: '{}',
    enriched: {
      packet: packet({ deviceId, sentAt: new Date(sentAt) }),
      zoneId: 'AMB',
      rejected: [],
      samples: samples.map(([ts, temperature]): EnrichedSample => ({
        ts: new Date(ts),
        deviceId,
        zoneId: 'AMB',
        temperature,
        businessHours: true,
        comfort: 'within',
      })),
    },
  };
}

describe('summarizeDevices', () => {
  it('keeps the earliest and latest instants per device, regardless of arrival order', () => {
    const updates = summarizeDevices([
      batchPacket('A', '2026-01-12T10:06:00Z', [['2026-01-12T10:06:00Z', 23]]),
      // saved_data: older packet arriving later must not become the latest reading
      batchPacket('A', '2026-01-12T09:00:00Z', [['2026-01-12T09:00:00Z', 30]]),
      batchPacket('B', '2026-01-12T10:00:00Z'),
    ]);

    expect(updates).toEqual([
      {
        deviceId: 'A',
        firstPacketAt: new Date('2026-01-12T09:00:00Z'),
        lastPacketAt: new Date('2026-01-12T10:06:00Z'),
        lastSampleAt: new Date('2026-01-12T10:06:00Z'),
        lastTemperature: 23,
      },
      {
        deviceId: 'B',
        firstPacketAt: new Date('2026-01-12T10:00:00Z'),
        lastPacketAt: new Date('2026-01-12T10:00:00Z'),
        lastSampleAt: null,
        lastTemperature: null,
      },
    ]);
  });
});

describe('latestPacketAt', () => {
  it('returns the most recent packet instant, or null for an empty batch', () => {
    expect(latestPacketAt([])).toBeNull();
    expect(
      latestPacketAt([
        batchPacket('A', '2026-01-12T10:00:00Z'),
        batchPacket('B', '2026-01-12T11:00:00Z'),
        batchPacket('C', '2026-01-12T09:00:00Z'),
      ]),
    ).toEqual(new Date('2026-01-12T11:00:00Z'));
  });
});
