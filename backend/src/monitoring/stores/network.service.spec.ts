import { LocalTimeResolver } from '../../shared/time/local-time';
import { TimeRange } from '../../shared/time/time-range';
import { Resolution } from '../domain/resolution';
import { ZoneEvaluator } from '../domain/zone-evaluation';
import {
  FixedClock,
  NEVER_OPEN,
  NOW,
  minutesAgo,
  zoneFacts,
} from '../testing/fakes';
import {
  NetworkReadModel,
  StoreFacts,
  StoreFilter,
} from './network.read-model';
import { NetworkService, StoreListQuery } from './network.service';

class StubNetworkReadModel extends NetworkReadModel {
  calls: Array<{
    filter: StoreFilter;
    range: TimeRange;
    resolution: Resolution;
  }> = [];

  constructor(private readonly stores: StoreFacts[]) {
    super();
  }

  async storeFacts(
    filter: StoreFilter,
    range: TimeRange,
    resolution: Resolution,
  ) {
    this.calls.push({ filter, range, resolution });
    return this.stores;
  }
}

function store(
  id: string,
  name: string,
  overrides: Partial<StoreFacts> = {},
): StoreFacts {
  return {
    id,
    name,
    kind: null,
    city: 'São Paulo',
    state: 'SP',
    timezone: 'America/Sao_Paulo',
    customer: { id: 'CLI-001', name: 'Moda Carioca' },
    zones: [zoneFacts({ id: `${id}-Z1` })],
    ...overrides,
  };
}

const offline = { lastPacketAt: minutesAgo(60), lastSampleAt: minutesAgo(60) };

const network = [
  // all online, 90% comfort, one zone above the band right now
  store('S-A', 'Alfa', {
    city: 'Recife',
    zones: [
      zoneFacts({ id: 'A1', lastTemperature: 27, withinSamples: 80 }),
      zoneFacts({ id: 'A2', withinSamples: 100 }),
    ],
  }),
  // one device offline
  store('S-B', 'Beta', {
    zones: [
      zoneFacts({ id: 'B1', withinSamples: 50 }),
      zoneFacts({ id: 'B2', ...offline, withinSamples: 50 }),
    ],
  }),
  // everything offline and closed
  store('S-C', 'Gama', {
    city: 'Belo Horizonte',
    zones: [
      zoneFacts({
        id: 'C1',
        ...offline,
        businessHours: NEVER_OPEN,
        withinSamples: 100,
      }),
    ],
  }),
  // never reported
  store('S-D', 'Delta', {
    zones: [
      zoneFacts({
        id: 'D1',
        lastPacketAt: null,
        lastSampleAt: null,
        lastTemperature: null,
        businessHoursSamples: 0,
        withinSamples: 0,
      }),
    ],
  }),
];

const query = (overrides: Partial<StoreListQuery> = {}): StoreListQuery => ({
  period: '7d',
  sort: 'name',
  order: 'asc',
  page: 1,
  pageSize: 20,
  ...overrides,
});

describe('NetworkService', () => {
  let readModel: StubNetworkReadModel;
  let service: NetworkService;

  beforeEach(() => {
    readModel = new StubNetworkReadModel(network);
    service = new NetworkService(
      new FixedClock(NOW),
      readModel,
      new ZoneEvaluator(new LocalTimeResolver()),
    );
  });

  it('reads the period ending at the reference time with a matching resolution', async () => {
    const result = await service.list(
      query({ customerId: 'CLI-001', search: 'al' }),
    );

    expect(readModel.calls).toEqual([
      {
        filter: { customerId: 'CLI-001', search: 'al' },
        range: { from: new Date(NOW.getTime() - 7 * 86_400_000), to: NOW },
        resolution: '15m',
      },
    ]);
    expect(result.referenceTime).toEqual(NOW);
    expect(result.period).toEqual({
      key: '7d',
      from: readModel.calls[0].range.from,
      to: NOW,
    });
  });

  it('derives status and indicators for each store and its zones', async () => {
    const { items } = await service.list(query());
    const alfa = items.find((s) => s.id === 'S-A');

    expect(items.map((s) => [s.id, s.status])).toEqual([
      ['S-A', 'online'],
      ['S-B', 'partial'],
      ['S-D', 'no_data'],
      ['S-C', 'offline'],
    ]);
    expect(alfa).toMatchObject({
      comfortPct: 90,
      zonesTotal: 2,
      zonesOnline: 2,
      zonesOutOfRange: 1,
    });
    expect(alfa?.zones[0]).toMatchObject({
      id: 'A1',
      deviceStatus: 'online',
      condition: 'above',
      currentTemperature: 27,
      comfortPct: 80,
    });
    expect(items.find((s) => s.id === 'S-D')?.comfortPct).toBeNull();
  });

  it('summarizes the whole filtered network, before the status filter', async () => {
    const { summary, total, items } = await service.list(
      query({ status: 'online' }),
    );

    expect(total).toBe(1);
    expect(items.map((s) => s.id)).toEqual(['S-A']);
    expect(summary).toEqual({
      stores: 4,
      zones: 6,
      zonesOnline: 3,
      zonesOutOfRange: 1,
      comfortPct: percentOf(380, 500),
      storesByStatus: { online: 1, partial: 1, offline: 1, no_data: 1 },
    });
  });

  it.each([
    ['name', 'asc', ['S-A', 'S-B', 'S-D', 'S-C']],
    ['name', 'desc', ['S-C', 'S-D', 'S-B', 'S-A']],
    ['city', 'asc', ['S-C', 'S-A', 'S-B', 'S-D']],
    ['status', 'asc', ['S-C', 'S-B', 'S-D', 'S-A']],
    ['comfort', 'asc', ['S-B', 'S-A', 'S-C', 'S-D']],
    ['comfort', 'desc', ['S-C', 'S-A', 'S-B', 'S-D']],
    ['outOfRange', 'desc', ['S-A', 'S-B', 'S-D', 'S-C']],
  ] as const)(
    'sorts by %s %s, ties by name and empty comfort last',
    async (sort, order, ids) => {
      const { items } = await service.list(query({ sort, order }));

      expect(items.map((s) => s.id)).toEqual(ids);
    },
  );

  it('paginates after filtering and sorting', async () => {
    const page2 = await service.list(query({ page: 2, pageSize: 3 }));

    expect(page2).toMatchObject({ page: 2, pageSize: 3, total: 4 });
    expect(page2.items.map((s) => s.id)).toEqual(['S-C']);
  });
});

function percentOf(part: number, total: number) {
  return Math.round((part / total) * 1000) / 10;
}
