import {
  OFFLINE_AFTER_MS,
  deviceStatus,
  isOutOfRange,
  percentage,
  storeStatus,
  zoneCondition,
} from './status';

describe('deviceStatus', () => {
  const now = new Date('2026-02-10T12:00:00Z');

  it('is no_data when the device never reported', () => {
    expect(deviceStatus(null, now)).toBe('no_data');
  });

  it('is online up to the offline threshold, inclusive', () => {
    const atThreshold = new Date(now.getTime() - OFFLINE_AFTER_MS);

    expect(deviceStatus(atThreshold, now)).toBe('online');
  });

  it('is offline after the threshold', () => {
    const late = new Date(now.getTime() - OFFLINE_AFTER_MS - 1);

    expect(deviceStatus(late, now)).toBe('offline');
  });

  it('accepts a custom threshold', () => {
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);

    expect(deviceStatus(fiveMinutesAgo, now, 60_000)).toBe('offline');
  });
});

describe('zoneCondition', () => {
  const band = { min: 21, max: 25 };

  it('is unknown when the device is not online or never sent a valid reading', () => {
    expect(
      zoneCondition({
        deviceStatus: 'offline',
        isOpen: true,
        lastTemperature: 23,
        band,
      }),
    ).toBe('unknown');
    expect(
      zoneCondition({
        deviceStatus: 'online',
        isOpen: true,
        lastTemperature: null,
        band,
      }),
    ).toBe('unknown');
  });

  it('is closed outside business hours, regardless of the temperature', () => {
    expect(
      zoneCondition({
        deviceStatus: 'online',
        isOpen: false,
        lastTemperature: 30,
        band,
      }),
    ).toBe('closed');
  });

  it('compares the last temperature to the band while open', () => {
    const open = { deviceStatus: 'online' as const, isOpen: true, band };

    expect(zoneCondition({ ...open, lastTemperature: 20 })).toBe('below');
    expect(zoneCondition({ ...open, lastTemperature: 23 })).toBe('within');
    expect(zoneCondition({ ...open, lastTemperature: 26 })).toBe('above');
  });
});

describe('isOutOfRange', () => {
  it('is true only for below and above', () => {
    expect(isOutOfRange('below')).toBe(true);
    expect(isOutOfRange('above')).toBe(true);
    expect(isOutOfRange('within')).toBe(false);
    expect(isOutOfRange('closed')).toBe(false);
    expect(isOutOfRange('unknown')).toBe(false);
  });
});

describe('storeStatus', () => {
  it.each([
    [[], 'no_data'],
    [['no_data', 'no_data'], 'no_data'],
    [['online', 'online'], 'online'],
    [['offline', 'offline'], 'offline'],
    [['offline', 'no_data'], 'offline'],
    [['online', 'offline'], 'partial'],
    [['online', 'no_data'], 'partial'],
  ] as const)('derives %j as %s', (devices, expected) => {
    expect(storeStatus(devices)).toBe(expected);
  });
});

describe('percentage', () => {
  it('rounds to one decimal place', () => {
    expect(percentage(2, 3)).toBe(66.7);
    expect(percentage(3, 3)).toBe(100);
  });

  it('is null without a denominator', () => {
    expect(percentage(0, 0)).toBeNull();
  });
});
