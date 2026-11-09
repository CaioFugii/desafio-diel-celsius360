import {
  Customer,
  Store,
  StoreList,
  ZoneSeries,
  ZoneStatus,
  ZoneSummary,
} from '../api/types';

export const REFERENCE_TIME = '2026-02-10T15:00:00.000Z';

export function zoneStatus(overrides: Partial<ZoneStatus> = {}): ZoneStatus {
  return {
    id: 'AMB001',
    name: 'Main floor',
    deviceId: 'IOT001',
    deviceStatus: 'online',
    condition: 'within',
    isOpen: true,
    currentTemperature: 22.4,
    lastReadingAt: '2026-02-10T14:58:00.000Z',
    comfortBand: { min: 20, max: 24 },
    comfortPct: 93.5,
    ...overrides,
  };
}

export function store(overrides: Partial<Store> = {}): Store {
  return {
    id: 'LOJ001',
    name: 'Paulista Store',
    kind: 'street store',
    city: 'São Paulo',
    state: 'SP',
    timezone: 'America/Sao_Paulo',
    customer: { id: 'CLI001', name: 'Alpha Retail' },
    status: 'online',
    comfortPct: 93.5,
    zonesTotal: 1,
    zonesOnline: 1,
    zonesOutOfRange: 0,
    zones: [zoneStatus()],
    ...overrides,
  };
}

export function storeList(overrides: Partial<StoreList> = {}): StoreList {
  const items = overrides.items ?? [store()];
  return {
    referenceTime: REFERENCE_TIME,
    period: { key: '7d', from: '2026-02-03T15:00:00.000Z', to: REFERENCE_TIME },
    summary: {
      stores: items.length,
      zones: 3,
      zonesOnline: 2,
      zonesOutOfRange: 1,
      comfortPct: 87.2,
      storesByStatus: { online: 1, partial: 0, offline: 0, no_data: 0 },
    },
    page: 1,
    pageSize: 20,
    total: items.length,
    items,
    ...overrides,
  };
}

export const CUSTOMERS: Customer[] = [
  { id: 'CLI001', name: 'Alpha Retail', segment: 'retail', stores: 3 },
  { id: 'CLI002', name: 'Beta Bank', segment: 'banking', stores: 2 },
];

export function zoneSummary(overrides: Partial<ZoneSummary> = {}): ZoneSummary {
  return {
    referenceTime: REFERENCE_TIME,
    zone: {
      id: 'AMB001',
      name: 'Main floor',
      comfortBand: { min: 20, max: 24 },
      businessHours: {
        mon: { open: '08:00', close: '22:00' },
        tue: { open: '08:00', close: '22:00' },
        wed: { open: '08:00', close: '22:00' },
        thu: { open: '08:00', close: '22:00' },
        fri: { open: '08:00', close: '22:00' },
        sat: { open: '09:00', close: '18:00' },
        sun: null,
      },
    },
    store: {
      id: 'LOJ001',
      name: 'Paulista Store',
      city: 'São Paulo',
      state: 'SP',
      timezone: 'America/Sao_Paulo',
    },
    customer: { id: 'CLI001', name: 'Alpha Retail' },
    device: { id: 'IOT001', status: 'online', lastPacketAt: '2026-02-10T14:58:00.000Z' },
    current: {
      temperature: 22.4,
      readingAt: '2026-02-10T14:58:00.000Z',
      condition: 'within',
      isOpen: true,
    },
    period: {
      key: '1d',
      from: '2026-02-09T15:00:00.000Z',
      to: REFERENCE_TIME,
      resolution: '1m',
    },
    indicators: {
      comfortPct: 91.3,
      belowPct: 3.2,
      abovePct: 5.5,
      businessHoursSamples: 1680,
      avgTemperature: 22.1,
      minTemperature: 19.4,
      maxTemperature: 25.2,
      availabilityPct: 97.9,
      gaps: 1,
      gapMinutes: 30,
      rejectedReadings: 2,
    },
    ...overrides,
  };
}

export function zoneSeries(overrides: Partial<ZoneSeries> = {}): ZoneSeries {
  return {
    zoneId: 'AMB001',
    from: '2026-02-10T12:00:00.000Z',
    to: '2026-02-10T13:00:00.000Z',
    resolution: '1m',
    bucketSeconds: 60,
    comfortBand: { min: 20, max: 24 },
    points: [
      { t: '2026-02-10T12:00:00.000Z', avg: 21.5, min: 21.2, max: 21.8, samples: 2 },
      { t: '2026-02-10T12:01:00.000Z', avg: 21.7, min: 21.5, max: 21.9, samples: 2 },
      { t: '2026-02-10T12:40:00.000Z', avg: 22.1, min: 22, max: 22.2, samples: 2 },
    ],
    gaps: [{ from: '2026-02-10T12:02:00.000Z', to: '2026-02-10T12:40:00.000Z' }],
    ...overrides,
  };
}
