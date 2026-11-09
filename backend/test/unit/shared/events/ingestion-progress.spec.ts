import {
  MAX_ZONES_PER_EVENT,
  decodeProgress,
  encodeProgress,
} from '../../../../src/shared/events/ingestion-progress';

describe('ingestion progress payload', () => {
  const progress = {
    source: 'telemetrias.jsonl',
    lastLine: 500,
    referenceTime: new Date('2026-02-10T12:00:00Z'),
    zoneIds: ['AMB-001', 'AMB-002'],
  };

  it('round-trips through the NOTIFY payload', () => {
    expect(decodeProgress(encodeProgress(progress))).toEqual(progress);
    expect(
      decodeProgress(encodeProgress({ ...progress, referenceTime: null })),
    ).toEqual({ ...progress, referenceTime: null });
  });

  it('falls back to "all zones" when the list would not fit in a notification', () => {
    const zoneIds = Array.from(
      { length: MAX_ZONES_PER_EVENT + 1 },
      (_, i) => `AMB-${i}`,
    );

    const payload = encodeProgress({ ...progress, zoneIds });

    expect(Buffer.byteLength(payload)).toBeLessThan(8_000);
    expect(decodeProgress(payload)?.zoneIds).toBeNull();
  });

  it.each([
    'not json',
    '42',
    'null',
    JSON.stringify({ source: 'x' }),
    JSON.stringify({ source: 'x', lastLine: 1, referenceTime: 'yesterday' }),
  ])('rejects a payload outside the contract (%s)', (payload) => {
    expect(decodeProgress(payload)).toBeNull();
  });

  it('treats a malformed zone list as "all zones"', () => {
    const payload = JSON.stringify({
      source: 'x',
      lastLine: 1,
      referenceTime: null,
      zoneIds: [1, 2],
    });

    expect(decodeProgress(payload)?.zoneIds).toBeNull();
  });
});
