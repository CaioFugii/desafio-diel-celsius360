import { mergeProgress } from '../../../../src/monitoring/domain/live-update';
import { IngestionProgress } from '../../../../src/shared/events/ingestion-progress';

const event = (
  lastLine: number,
  time: string | null,
  zoneIds: string[] | null,
): IngestionProgress => ({
  source: 'telemetrias.jsonl',
  lastLine,
  referenceTime: time ? new Date(time) : null,
  zoneIds,
});

describe('mergeProgress', () => {
  it('keeps the latest "now" and the union of the zones', () => {
    expect(
      mergeProgress([
        event(500, '2026-02-10T12:00:00Z', ['AMB-002', 'AMB-001']),
        event(1_000, '2026-02-10T12:05:00Z', ['AMB-001', 'AMB-003']),
        event(1_500, '2026-02-10T12:01:00Z', []),
      ]),
    ).toEqual({
      referenceTime: new Date('2026-02-10T12:05:00Z'),
      zoneIds: ['AMB-001', 'AMB-002', 'AMB-003'],
    });
  });

  it('widens to "all zones" when any batch did not list them', () => {
    expect(
      mergeProgress([
        event(500, null, ['AMB-001']),
        event(1_000, null, null),
        event(1_500, null, ['AMB-002']),
      ]),
    ).toEqual({ referenceTime: null, zoneIds: null });
  });
});
