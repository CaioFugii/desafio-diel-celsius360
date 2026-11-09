import { LocalTimeResolver, isValidTimeZone } from './local-time';

describe('LocalTimeResolver', () => {
  const resolver = new LocalTimeResolver();

  it('converts an instant to the wall clock of the zone', () => {
    // 2026-01-12T12:30:00Z is a Monday, 09:30 in São Paulo (UTC-3).
    const local = resolver.resolve(
      new Date('2026-01-12T12:30:00Z'),
      'America/Sao_Paulo',
    );

    expect(local).toEqual({ weekday: 1, minuteOfDay: 9 * 60 + 30 });
  });

  it('rolls the weekday back when the local date is still the previous day', () => {
    // 02:00Z on Monday is 23:00 on Sunday in Recife.
    const local = resolver.resolve(
      new Date('2026-01-12T02:00:00Z'),
      'America/Recife',
    );

    expect(local).toEqual({ weekday: 0, minuteOfDay: 23 * 60 });
  });

  it('honours daylight saving transitions', () => {
    const winter = resolver.offsetMs(
      new Date('2026-01-15T12:00:00Z'),
      'America/New_York',
    );
    const summer = resolver.offsetMs(
      new Date('2026-07-15T12:00:00Z'),
      'America/New_York',
    );

    expect(winter).toBe(-5 * 3_600_000);
    expect(summer).toBe(-4 * 3_600_000);
  });

  it('returns the same offset for instants within the same minute', () => {
    const a = resolver.offsetMs(new Date('2026-01-12T12:30:01Z'), 'UTC');
    const b = resolver.offsetMs(new Date('2026-01-12T12:30:59Z'), 'UTC');

    expect(a).toBe(0);
    expect(b).toBe(0);
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects unknown names', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false);
  });
});
