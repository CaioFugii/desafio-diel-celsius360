export interface LocalTime {
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  minuteOfDay: number;
}

const MINUTE_MS = 60_000;
const MAX_CACHED_OFFSETS = 100_000;

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts instants to wall-clock time in an IANA zone. Offsets are cached per
 * zone and minute: zone transitions always happen on minute boundaries, and
 * the ingestion evaluates millions of samples against a handful of zones.
 */
export class LocalTimeResolver {
  private readonly formatters = new Map<string, Intl.DateTimeFormat>();
  private readonly offsets = new Map<string, number>();

  resolve(instant: Date, timeZone: string): LocalTime {
    const local = new Date(
      instant.getTime() + this.offsetMs(instant, timeZone),
    );
    return {
      weekday: local.getUTCDay(),
      minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
    };
  }

  offsetMs(instant: Date, timeZone: string): number {
    const minute = Math.floor(instant.getTime() / MINUTE_MS);
    const key = `${timeZone}|${minute}`;
    const cached = this.offsets.get(key);
    if (cached !== undefined) return cached;

    if (this.offsets.size >= MAX_CACHED_OFFSETS) this.offsets.clear();
    const offset = this.computeOffsetMs(minute * MINUTE_MS, timeZone);
    this.offsets.set(key, offset);
    return offset;
  }

  private computeOffsetMs(epochMs: number, timeZone: string): number {
    const parts = this.formatter(timeZone).formatToParts(new Date(epochMs));
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((p) => p.type === type)?.value);
    const wallClockAsUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return wallClockAsUtc - epochMs;
  }

  private formatter(timeZone: string): Intl.DateTimeFormat {
    let formatter = this.formatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      });
      this.formatters.set(timeZone, formatter);
    }
    return formatter;
  }
}
