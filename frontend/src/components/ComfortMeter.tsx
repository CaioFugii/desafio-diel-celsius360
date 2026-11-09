import { formatPercent } from '../lib/format';
import { comfortTone } from '../lib/labels';
import { LiveValue } from './LiveValue';

export function ComfortMeter({ value, scope }: { value: number | null; scope?: string }) {
  const tone = comfortTone(value);
  return (
    <div
      className={`meter meter--${tone}`}
      role="meter"
      aria-label="Conforto no período"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'sem dados' : formatPercent(value)}
    >
      <div className="meter__track">
        <div className="meter__fill" style={{ width: `${value ?? 0}%` }} />
      </div>
      <span className="meter__value">
        <LiveValue value={value} kind="percent" better="up" scope={scope} />
      </span>
    </div>
  );
}
