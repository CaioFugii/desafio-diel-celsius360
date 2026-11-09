import { LocalTimeResolver } from '../../../../src/shared/time/local-time';
import { Ds18b20QualityPolicy } from '../../../../src/telemetry/domain/reading-quality';
import { PacketEnricher } from '../../../../src/ingestion/services/packet-enricher';
import {
  directoryOf,
  packet,
  zoneContext,
} from '../../support/ingestion.fixtures';

describe('PacketEnricher', () => {
  const enricher = new PacketEnricher(
    directoryOf({ IOT001: zoneContext() }),
    new Ds18b20QualityPolicy(),
    new LocalTimeResolver(),
  );

  it('expands readings into samples tied to the zone, with comfort and business hours', () => {
    // 12:00Z = 09:00 local on a Monday: the first reading (08:59:30) is before opening.
    const result = enricher.enrich(packet({ readings: [20, 23, 26] }));

    expect(result.zoneId).toBe('AMB-001');
    expect(result.rejected).toEqual([]);
    expect(result.samples).toEqual([
      {
        ts: new Date('2026-01-12T11:59:00Z'),
        deviceId: 'IOT001',
        zoneId: 'AMB-001',
        temperature: 20,
        businessHours: false,
        comfort: 'below',
      },
      {
        ts: new Date('2026-01-12T11:59:30Z'),
        deviceId: 'IOT001',
        zoneId: 'AMB-001',
        temperature: 23,
        businessHours: false,
        comfort: 'within',
      },
      {
        ts: new Date('2026-01-12T12:00:00Z'),
        deviceId: 'IOT001',
        zoneId: 'AMB-001',
        temperature: 26,
        businessHours: true,
        comfort: 'above',
      },
    ]);
  });

  it('separates spurious readings with the reason they were discarded', () => {
    const result = enricher.enrich(packet({ readings: [-127, 23, 85, 'x'] }));

    expect(result.samples.map((s) => s.temperature)).toEqual([23]);
    expect(result.rejected).toEqual([
      expect.objectContaining({
        temperature: -127,
        reason: 'sensor_error_code',
      }),
      expect.objectContaining({ temperature: 85, reason: 'sensor_error_code' }),
      expect.objectContaining({ temperature: null, reason: 'not_a_number' }),
    ]);
  });

  it('keeps packets from unregistered devices out of the series', () => {
    const result = enricher.enrich(
      packet({ deviceId: 'IOT099', readings: [23, -127] }),
    );

    expect(result).toMatchObject({ zoneId: null, samples: [], rejected: [] });
  });

  it('evaluates business hours in the store time zone', () => {
    const recife = new PacketEnricher(
      directoryOf({ IOT014: zoneContext({ timeZone: 'America/Recife' }) }),
      new Ds18b20QualityPolicy(),
      new LocalTimeResolver(),
    );

    // Sunday 23:00Z = 20:00 local on Sunday, when the store is closed.
    const result = recife.enrich(
      packet({ deviceId: 'IOT014', sentAt: new Date('2026-01-11T23:00:00Z') }),
    );

    expect(result.samples[0].businessHours).toBe(false);
  });
});
