import { ReactNode, useState } from 'react';
import { useAnimatedNumber } from '../lib/use-animated-number';
import {
  Change,
  Direction,
  ValueKind,
  changeBetween,
  formatChange,
  formatValue,
  isDisplayChange,
} from '../lib/value-change';

/** Matches the length of the highlight animation in index.css. */
export const TRANSITION_MS = 450;

interface LiveValueProps {
  value: number | null;
  kind: ValueKind;
  /** Direction that is good news, used to color the change; omitted for neutral values like temperature. */
  better?: Direction;
  /** Identifies what the value refers to (filters, period); a new scope is a new baseline, not a change. */
  scope?: string;
  /** Rendered right after the number, before the change (e.g. "/25"). */
  suffix?: ReactNode;
}

interface Tracked {
  value: number | null;
  scope: string;
  change: Change | null;
  flashes: number;
}

function track(previous: Tracked, value: number | null, scope: string, kind: ValueKind): Tracked {
  if (scope !== previous.scope) return { ...previous, value, scope, change: null };
  if (!isDisplayChange(previous.value, value, kind)) return { ...previous, value };
  return {
    value,
    scope,
    change: changeBetween(previous.value, value, kind),
    flashes: value === null ? previous.flashes : previous.flashes + 1,
  };
}

/** A number that highlights itself, glides to its new value and shows how much it moved. */
export function LiveValue({ value, kind, better, scope = '', suffix }: LiveValueProps) {
  const [tracked, setTracked] = useState<Tracked>({ value, scope, change: null, flashes: 0 });
  const unchanged = value === tracked.value && scope === tracked.scope;
  const current = unchanged ? tracked : track(tracked, value, scope, kind);
  if (current !== tracked) setTracked(current);
  const shown = useAnimatedNumber(value, scope, TRANSITION_MS);

  return (
    <span className="live-value">
      {current.flashes > 0 && (
        <span key={current.flashes} className="live-value__flash" aria-hidden="true" />
      )}
      <span className="live-value__number">{formatValue(shown, kind)}</span>
      {suffix}
      {current.change && <ChangeTag change={current.change} kind={kind} better={better} />}
    </span>
  );
}

function ChangeTag({ change, kind, better }: { change: Change; kind: ValueKind; better?: Direction }) {
  const up = change.direction === 'up';
  const tone = better === undefined ? 'neutral' : change.direction === better ? 'good' : 'bad';
  return (
    <span
      className={`live-value__change live-value__change--${tone}`}
      title="Variação em relação à leitura anterior"
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      <span className="sr-only">{up ? 'aumentou' : 'diminuiu'}</span> {formatChange(change.delta, kind)}
    </span>
  );
}
