import { DeviceStatus, PeriodKey, StoreStatus, ZoneCondition } from '../api/types';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface Label {
  text: string;
  tone: Tone;
}

export const STORE_STATUS: Record<StoreStatus, Label> = {
  online: { text: 'Online', tone: 'success' },
  partial: { text: 'Parcial', tone: 'warning' },
  offline: { text: 'Offline', tone: 'danger' },
  no_data: { text: 'Sem dados', tone: 'neutral' },
};

export const DEVICE_STATUS: Record<DeviceStatus, Label> = {
  online: { text: 'Online', tone: 'success' },
  offline: { text: 'Offline', tone: 'danger' },
  no_data: { text: 'Sem dados', tone: 'neutral' },
};

export const ZONE_CONDITION: Record<ZoneCondition, Label> = {
  within: { text: 'Na faixa', tone: 'success' },
  below: { text: 'Abaixo da faixa', tone: 'info' },
  above: { text: 'Acima da faixa', tone: 'danger' },
  closed: { text: 'Fora do horário', tone: 'neutral' },
  unknown: { text: 'Sem leitura atual', tone: 'neutral' },
};

export const PERIODS: Array<{ key: PeriodKey; text: string }> = [
  { key: '1d', text: 'Último dia' },
  { key: '7d', text: 'Última semana' },
  { key: '30d', text: '30 dias' },
];

/** Comfort target used to color indicators: >= 90% good, >= 75% attention. */
export function comfortTone(pct: number | null): Tone {
  if (pct === null) return 'neutral';
  if (pct >= 90) return 'success';
  if (pct >= 75) return 'warning';
  return 'danger';
}
