import { LocalTimeResolver } from '../../../../src/shared/time/local-time';
import { STORE_HOURS } from '../../support/ingestion.fixtures';
import {
  ALWAYS_OPEN,
  NOW,
  minutesAgo,
  zoneFacts,
} from '../../support/monitoring.fakes';
import { ZoneEvaluator } from '../../../../src/monitoring/domain/zone-evaluation';

describe('ZoneEvaluator', () => {
  const evaluator = new ZoneEvaluator(new LocalTimeResolver());
  const tz = 'America/Sao_Paulo';

  it('reports an online, open zone with its current temperature and comfort', () => {
    expect(
      evaluator.evaluate(zoneFacts({ lastTemperature: 26 }), tz, NOW),
    ).toEqual({
      deviceStatus: 'online',
      isOpen: true,
      currentTemperature: 26,
      condition: 'above',
    });
  });

  it('uses the store time zone to decide whether the zone is open', () => {
    // NOW is 12:00 in São Paulo on a Tuesday: open. 05:00Z is 02:00 local: closed.
    const facts = zoneFacts({ businessHours: STORE_HOURS });

    expect(evaluator.evaluate(facts, tz, NOW).isOpen).toBe(true);
    const night = new Date('2026-02-10T05:00:00Z');
    expect(
      evaluator.evaluate(
        { ...facts, lastPacketAt: night, lastSampleAt: night },
        tz,
        night,
      ),
    ).toMatchObject({ isOpen: false, condition: 'closed' });
  });

  it('ignores a stale temperature when the sensor only sends error codes', () => {
    const facts = zoneFacts({
      lastPacketAt: minutesAgo(1),
      lastSampleAt: minutesAgo(60),
    });

    expect(evaluator.evaluate(facts, tz, NOW)).toMatchObject({
      deviceStatus: 'online',
      currentTemperature: null,
      condition: 'unknown',
    });
  });

  it('reports no_data for a zone without a device', () => {
    const facts = zoneFacts({ deviceId: null, businessHours: ALWAYS_OPEN });

    expect(evaluator.evaluate(facts, tz, NOW)).toMatchObject({
      deviceStatus: 'no_data',
      condition: 'unknown',
    });
  });
});
