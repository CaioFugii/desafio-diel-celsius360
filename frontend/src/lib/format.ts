const LOCALE = 'pt-BR';

export function formatTemperature(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} °C`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%`;
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let format = dateTimeFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE, { timeZone, hourCycle: 'h23', ...options });
    dateTimeFormats.set(key, format);
  }
  return format;
}

/** Date and time in the store's time zone, e.g. "10/02 23:59". */
export function formatDateTime(iso: string | number | null | undefined, timeZone: string): string {
  if (iso === null || iso === undefined) return '—';
  return formatter(timeZone, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTime(iso: string | number, timeZone: string): string {
  return formatter(timeZone, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDay(iso: string | number, timeZone: string): string {
  return formatter(timeZone, { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest ? `${hours} h ${rest} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}
