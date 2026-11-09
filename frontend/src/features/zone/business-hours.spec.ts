import { WeeklyHours } from '../../api/types';
import { describeBusinessHours } from './business-hours';
import { parsePeriod } from './zone-params';

const day = (open: string, close: string) => ({ open, close });

describe('describeBusinessHours', () => {
  it('groups consecutive days with the same hours', () => {
    const hours: WeeklyHours = {
      mon: day('08:00', '22:00'),
      tue: day('08:00', '22:00'),
      wed: day('08:00', '22:00'),
      thu: day('08:00', '22:00'),
      fri: day('08:00', '22:00'),
      sat: day('09:00', '18:00'),
      sun: null,
    };
    expect(describeBusinessHours(hours)).toBe('Seg–Sex 08:00–22:00 · Sáb 09:00–18:00 · Dom fechado');
  });

  it('collapses a week with identical hours into one group', () => {
    const open = day('10:00', '22:00');
    const hours: WeeklyHours = { mon: open, tue: open, wed: open, thu: open, fri: open, sat: open, sun: open };
    expect(describeBusinessHours(hours)).toBe('Seg–Dom 10:00–22:00');
  });
});

describe('parsePeriod', () => {
  it('accepts known periods and defaults to the last day', () => {
    expect(parsePeriod('30d')).toBe('30d');
    expect(parsePeriod('90d')).toBe('1d');
    expect(parsePeriod(null)).toBe('1d');
  });
});
