import { PeriodKey } from '../api/types';
import { PERIODS } from '../lib/labels';

interface PeriodSelectorProps {
  value: PeriodKey;
  onChange(period: PeriodKey): void;
}

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Período">
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          role="radio"
          aria-checked={value === p.key}
          className={value === p.key ? 'segmented__item is-active' : 'segmented__item'}
          onClick={() => onChange(p.key)}
        >
          {p.text}
        </button>
      ))}
    </div>
  );
}
