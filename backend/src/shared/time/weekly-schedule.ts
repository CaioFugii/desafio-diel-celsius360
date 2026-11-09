export const WEEKDAYS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Opening window in local wall-clock time, "HH:MM" (close may be "24:00"). */
export interface DailyWindow {
  open: string;
  close: string;
}

export type WeeklyHours = Record<Weekday, DailyWindow | null>;

interface MinuteWindow {
  open: number;
  close: number;
}

const CLOCK = /^([01]\d|2[0-4]):([0-5]\d)$/;

function toMinutes(clock: string): number {
  const match = CLOCK.exec(clock);
  if (!match) throw new Error(`horário inválido "${clock}"`);
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  if (minutes > 24 * 60) throw new Error(`horário inválido "${clock}"`);
  return minutes;
}

/**
 * Weekly opening hours. Windows are [open, close) and must not cross midnight,
 * which covers every schedule in the registry (24h operation is 00:00-24:00).
 */
export class WeeklySchedule {
  private constructor(
    private readonly hours: WeeklyHours,
    private readonly windows: ReadonlyArray<MinuteWindow | null>,
  ) {}

  static from(hours: WeeklyHours): WeeklySchedule {
    const windows = WEEKDAYS.map((day) => {
      const window = hours[day];
      if (window === undefined)
        throw new Error(`dia da semana ausente "${day}"`);
      if (window === null) return null;
      const open = toMinutes(window.open);
      const close = toMinutes(window.close);
      if (close <= open) {
        throw new Error(
          `${day}: fechamento (${window.close}) deve ser depois da abertura (${window.open})`,
        );
      }
      return { open, close };
    });
    return new WeeklySchedule(hours, windows);
  }

  isOpen(weekday: number, minuteOfDay: number): boolean {
    const window = this.windows[weekday];
    return (
      window != null && minuteOfDay >= window.open && minuteOfDay < window.close
    );
  }

  toJSON(): WeeklyHours {
    return this.hours;
  }
}
