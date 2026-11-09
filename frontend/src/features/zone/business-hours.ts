import { WeeklyHours } from '../../api/types';

const DAYS: Array<{ key: keyof WeeklyHours; label: string }> = [
  { key: 'mon', label: 'Seg' },
  { key: 'tue', label: 'Ter' },
  { key: 'wed', label: 'Qua' },
  { key: 'thu', label: 'Qui' },
  { key: 'fri', label: 'Sex' },
  { key: 'sat', label: 'Sáb' },
  { key: 'sun', label: 'Dom' },
];

/** Groups consecutive days with the same hours, e.g. "Seg–Sex 08:00–22:00 · Sáb 09:00–18:00 · Dom fechado". */
export function describeBusinessHours(hours: WeeklyHours): string {
  const groups: Array<{ first: string; last: string; text: string }> = [];
  for (const { key, label } of DAYS) {
    const window = hours[key];
    const text = window ? `${window.open}–${window.close}` : 'fechado';
    const current = groups[groups.length - 1];
    if (current && current.text === text) current.last = label;
    else groups.push({ first: label, last: label, text });
  }
  return groups
    .map((g) => `${g.first === g.last ? g.first : `${g.first}–${g.last}`} ${g.text}`)
    .join(' · ');
}
