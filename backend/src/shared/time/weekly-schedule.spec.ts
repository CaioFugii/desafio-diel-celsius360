import { WeeklyHours, WeeklySchedule } from './weekly-schedule';

const weekdays = (open: string, close: string): WeeklyHours => ({
  sun: null,
  mon: { open, close },
  tue: { open, close },
  wed: { open, close },
  thu: { open, close },
  fri: { open, close },
  sat: null,
});

describe('WeeklySchedule', () => {
  const schedule = WeeklySchedule.from(weekdays('09:00', '20:00'));

  it('is open from the opening minute up to, but excluding, the closing minute', () => {
    expect(schedule.isOpen(1, 9 * 60 - 1)).toBe(false);
    expect(schedule.isOpen(1, 9 * 60)).toBe(true);
    expect(schedule.isOpen(1, 20 * 60 - 1)).toBe(true);
    expect(schedule.isOpen(1, 20 * 60)).toBe(false);
  });

  it('is closed on days without a window', () => {
    expect(schedule.isOpen(0, 12 * 60)).toBe(false);
    expect(schedule.isOpen(6, 12 * 60)).toBe(false);
  });

  it('treats 00:00-24:00 as open all day', () => {
    const allDay = WeeklySchedule.from(weekdays('00:00', '24:00'));

    expect(allDay.isOpen(3, 0)).toBe(true);
    expect(allDay.isOpen(3, 24 * 60 - 1)).toBe(true);
  });

  it('rejects malformed times, windows crossing midnight and missing days', () => {
    expect(() => WeeklySchedule.from(weekdays('9h', '20:00'))).toThrow(
      /horário inválido/,
    );
    expect(() => WeeklySchedule.from(weekdays('24:30', '24:40'))).toThrow(
      /horário inválido/,
    );
    expect(() => WeeklySchedule.from(weekdays('22:00', '02:00'))).toThrow(
      /deve ser depois/,
    );
    const withoutMonday: Partial<WeeklyHours> = weekdays('09:00', '20:00');
    delete withoutMonday.mon;
    expect(() => WeeklySchedule.from(withoutMonday as WeeklyHours)).toThrow(
      /dia da semana ausente "mon"/,
    );
  });

  it('serializes back to the original hours', () => {
    expect(schedule.toJSON()).toEqual(weekdays('09:00', '20:00'));
  });
});
