import {
  PeriodKey,
  SortOrder,
  StoreListParams,
  StoreSortKey,
  StoreStatus,
} from '../../api/types';

export const PAGE_SIZE = 20;

const PERIOD_KEYS: readonly PeriodKey[] = ['1d', '7d', '30d'];
const SORT_KEYS: readonly StoreSortKey[] = ['name', 'city', 'status', 'comfort', 'outOfRange'];
const STATUSES: readonly StoreStatus[] = ['online', 'partial', 'offline', 'no_data'];

export const DEFAULT_PARAMS: StoreListParams = {
  period: '7d',
  sort: 'name',
  order: 'asc',
  page: 1,
  pageSize: PAGE_SIZE,
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((item) => item === value);
}

/** Reads the network filters from the URL, ignoring anything invalid. */
export function parseNetworkParams(search: URLSearchParams): StoreListParams {
  const page = Number(search.get('page'));
  return {
    period: oneOf(search.get('period'), PERIOD_KEYS) ?? DEFAULT_PARAMS.period,
    customerId: search.get('customerId') || undefined,
    search: search.get('search')?.trim() || undefined,
    status: oneOf(search.get('status'), STATUSES),
    sort: oneOf(search.get('sort'), SORT_KEYS) ?? DEFAULT_PARAMS.sort,
    order: oneOf<SortOrder>(search.get('order'), ['asc', 'desc']) ?? DEFAULT_PARAMS.order,
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZE,
  };
}

/** Writes only what differs from the defaults so URLs stay short and shareable. */
export function serializeNetworkParams(params: StoreListParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.period !== DEFAULT_PARAMS.period) out.set('period', params.period);
  if (params.customerId) out.set('customerId', params.customerId);
  if (params.search) out.set('search', params.search);
  if (params.status) out.set('status', params.status);
  if (params.sort !== DEFAULT_PARAMS.sort) out.set('sort', params.sort);
  if (params.order !== DEFAULT_PARAMS.order) out.set('order', params.order);
  if (params.page > 1) out.set('page', String(params.page));
  return out;
}

/** Changing any filter goes back to the first page; changing the page keeps the filters. */
export function updateNetworkParams(
  current: StoreListParams,
  change: Partial<StoreListParams>,
): StoreListParams {
  const page = change.page ?? 1;
  return { ...current, ...change, page };
}

/** Clicking the active column flips the order; a new column starts with its natural order. */
export function toggleSort(current: StoreListParams, sort: StoreSortKey): StoreListParams {
  if (current.sort === sort) {
    return updateNetworkParams(current, { order: current.order === 'asc' ? 'desc' : 'asc' });
  }
  const descFirst: StoreSortKey[] = ['outOfRange'];
  return updateNetworkParams(current, { sort, order: descFirst.includes(sort) ? 'desc' : 'asc' });
}
