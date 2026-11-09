import { Tone } from '../lib/labels';

interface BadgeProps {
  tone: Tone;
  children: string;
  title?: string;
}

export function Badge({ tone, children, title }: BadgeProps) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  );
}
