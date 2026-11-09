import {
  InvalidRangeError,
  MAX_RANGE_MS,
  resolveRange,
} from '../../../../src/monitoring/domain/zone-range';

describe('resolveRange', () => {
  const now = new Date('2026-02-10T12:00:00Z');

  it('defaults to the last day', () => {
    expect(resolveRange({}, now)).toEqual({
      from: new Date('2026-02-09T12:00:00Z'),
      to: now,
    });
  });

  it('uses the requested period', () => {
    expect(resolveRange({ period: '7d' }, now).from).toEqual(
      new Date('2026-02-03T12:00:00Z'),
    );
  });

  it('prefers an explicit range over the period', () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-01-02T00:00:00Z');

    expect(resolveRange({ period: '30d', from, to }, now)).toEqual({
      from,
      to,
    });
  });

  it.each([
    [{ from: now }, /juntos/],
    [{ to: now }, /juntos/],
    [{ from: now, to: now }, /anterior/],
    [{ from: new Date(now.getTime() - MAX_RANGE_MS - 1), to: now }, /92 dias/],
  ])('rejects %j', (query, message) => {
    expect(() => resolveRange(query, now)).toThrow(InvalidRangeError);
    expect(() => resolveRange(query, now)).toThrow(message);
  });
});
