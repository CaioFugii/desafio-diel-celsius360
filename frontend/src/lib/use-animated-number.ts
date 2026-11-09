import { useEffect, useRef, useState } from 'react';
import { easeOutCubic, interpolate } from './value-change';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Follows `target`, gliding from the value currently on screen to the new one.
 * A new `scope` (e.g. another period) jumps straight to the target.
 */
export function useAnimatedNumber(
  target: number | null,
  scope: string,
  durationMs: number,
): number | null {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  const scopeRef = useRef(scope);

  useEffect(() => {
    const from = shownRef.current;
    const jump =
      scope !== scopeRef.current ||
      target === null ||
      from === null ||
      from === target ||
      prefersReducedMotion();
    scopeRef.current = scope;
    if (jump) {
      shownRef.current = target;
      setShown(target);
      return;
    }

    let frame = 0;
    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const progress = Math.min(1, (now - start) / durationMs);
      shownRef.current = interpolate(from, target, easeOutCubic(progress));
      setShown(shownRef.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, scope, durationMs]);

  // nothing to glide from or to: show the target right away instead of one stale frame
  if (target === null || shown === null || scope !== scopeRef.current) return target;
  return shown;
}
