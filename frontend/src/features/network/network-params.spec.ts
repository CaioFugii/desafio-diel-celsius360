import {
  DEFAULT_PARAMS,
  parseNetworkParams,
  serializeNetworkParams,
  toggleSort,
  updateNetworkParams,
} from './network-params';

describe('network params', () => {
  it('uses defaults for an empty URL', () => {
    expect(parseNetworkParams(new URLSearchParams())).toEqual(DEFAULT_PARAMS);
  });

  it('reads every filter from the URL', () => {
    const params = parseNetworkParams(
      new URLSearchParams(
        'period=30d&customerId=CLI002&search=%20batel%20&status=partial&sort=comfort&order=desc&page=3',
      ),
    );
    expect(params).toEqual({
      period: '30d',
      customerId: 'CLI002',
      search: 'batel',
      status: 'partial',
      sort: 'comfort',
      order: 'desc',
      page: 3,
      pageSize: 20,
    });
  });

  it('ignores invalid values instead of sending them to the API', () => {
    const params = parseNetworkParams(
      new URLSearchParams('period=2d&status=broken&sort=temp&order=up&page=-1&search=%20%20'),
    );
    expect(params).toEqual(DEFAULT_PARAMS);
    expect(parseNetworkParams(new URLSearchParams('page=1.5')).page).toBe(1);
  });

  it('serializes only non-default values and round-trips', () => {
    expect(serializeNetworkParams(DEFAULT_PARAMS).toString()).toBe('');
    const params = { ...DEFAULT_PARAMS, period: '1d', search: 'x', status: 'offline', page: 2 } as const;
    const url = serializeNetworkParams({ ...params, customerId: 'C', sort: 'city', order: 'desc' });
    expect(url.toString()).toBe(
      'period=1d&customerId=C&search=x&status=offline&sort=city&order=desc&page=2',
    );
    expect(parseNetworkParams(url)).toEqual({ ...params, customerId: 'C', sort: 'city', order: 'desc' });
  });

  it('resets to the first page when a filter changes, but not when paging', () => {
    const onPage3 = { ...DEFAULT_PARAMS, page: 3 };
    expect(updateNetworkParams(onPage3, { status: 'online' })).toMatchObject({ status: 'online', page: 1 });
    expect(updateNetworkParams(onPage3, { page: 4 })).toMatchObject({ page: 4 });
  });

  it('flips the order on the active column and picks a natural order for a new one', () => {
    const byNameAsc = { ...DEFAULT_PARAMS, page: 2 };
    expect(toggleSort(byNameAsc, 'name')).toMatchObject({ sort: 'name', order: 'desc', page: 1 });
    expect(toggleSort({ ...byNameAsc, order: 'desc' }, 'name')).toMatchObject({ order: 'asc' });
    expect(toggleSort(byNameAsc, 'city')).toMatchObject({ sort: 'city', order: 'asc' });
    expect(toggleSort(byNameAsc, 'outOfRange')).toMatchObject({ sort: 'outOfRange', order: 'desc' });
  });
});
