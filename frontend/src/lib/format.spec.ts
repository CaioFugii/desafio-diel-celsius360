import {
  formatDateTime,
  formatDay,
  formatDuration,
  formatPercent,
  formatTemperature,
  formatTime,
} from './format';

const SP = 'America/Sao_Paulo';

describe('format', () => {
  it('formats temperatures with a comma and fixed digits', () => {
    expect(formatTemperature(22.45)).toBe('22,5 °C');
    expect(formatTemperature(22, 2)).toBe('22,00 °C');
    expect(formatTemperature(null)).toBe('—');
    expect(formatTemperature(undefined)).toBe('—');
  });

  it('formats percentages with up to one decimal', () => {
    expect(formatPercent(93.5)).toBe('93,5%');
    expect(formatPercent(100)).toBe('100%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats instants in the store time zone', () => {
    const iso = '2026-02-10T02:59:56Z';
    expect(formatDateTime(iso, SP)).toBe('09/02, 23:59');
    expect(formatDateTime(Date.parse(iso), 'UTC')).toBe('10/02, 02:59');
    expect(formatDateTime('2026-02-10T03:05:00Z', SP)).toBe('10/02, 00:05');
    expect(formatDateTime(null, SP)).toBe('—');
    expect(formatTime(iso, SP)).toBe('23:59');
    expect(formatDay(iso, SP)).toBe('09/02');
  });

  it('formats durations from minutes to days', () => {
    expect(formatDuration(14.6)).toBe('15 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(135)).toBe('2 h 15 min');
    expect(formatDuration(48 * 60)).toBe('2 d');
    expect(formatDuration(27 * 60 + 10)).toBe('1 d 3 h');
  });
});
