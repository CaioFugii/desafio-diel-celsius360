import { LiveStatus } from '../api/types';
import { Badge } from './Badge';
import { Tone } from '../lib/labels';

const LABELS: Record<LiveStatus, { text: string; tone: Tone; title: string }> = {
  open: {
    text: 'Ao vivo',
    tone: 'success',
    title: 'As telas se atualizam conforme a ingestão grava novos dados',
  },
  connecting: {
    text: 'Conectando…',
    tone: 'neutral',
    title: 'Abrindo a conexão de tempo real',
  },
  reconnecting: {
    text: 'Reconectando…',
    tone: 'warning',
    title: 'Conexão de tempo real interrompida; os dados podem estar desatualizados',
  },
};

export function LiveIndicator({ status }: { status: LiveStatus }) {
  const { text, tone, title } = LABELS[status];
  return (
    <span className="live" role="status" aria-label="Tempo real">
      <Badge tone={tone} title={title}>
        {text}
      </Badge>
    </span>
  );
}
