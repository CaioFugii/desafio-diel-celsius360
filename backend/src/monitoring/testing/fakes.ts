import { WeeklyHours } from '../../shared/time/weekly-schedule';
import { ReferenceClock } from '../reference-clock';
import { ZoneFacts } from '../stores/network.read-model';

export class FixedClock extends ReferenceClock {
  constructor(private readonly instant: Date) {
    super();
  }

  async now(): Promise<Date> {
    return this.instant;
  }
}

const open = (from: string, to: string) => ({ open: from, close: to });

export const ALWAYS_OPEN: WeeklyHours = {
  sun: open('00:00', '24:00'),
  mon: open('00:00', '24:00'),
  tue: open('00:00', '24:00'),
  wed: open('00:00', '24:00'),
  thu: open('00:00', '24:00'),
  fri: open('00:00', '24:00'),
  sat: open('00:00', '24:00'),
};

export const NEVER_OPEN: WeeklyHours = {
  sun: null,
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
  sat: null,
};

export const NOW = new Date('2026-02-10T15:00:00Z');
export const minutesAgo = (minutes: number) =>
  new Date(NOW.getTime() - minutes * 60_000);

export function zoneFacts(overrides: Partial<ZoneFacts> = {}): ZoneFacts {
  return {
    id: 'AMB-001',
    name: 'Vitrine',
    deviceId: 'IOT001',
    band: { min: 21, max: 25 },
    businessHours: ALWAYS_OPEN,
    lastPacketAt: minutesAgo(2),
    lastSampleAt: minutesAgo(2),
    lastTemperature: 23,
    businessHoursSamples: 100,
    withinSamples: 90,
    ...overrides,
  };
}
