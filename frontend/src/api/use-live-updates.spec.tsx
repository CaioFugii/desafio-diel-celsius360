import { act, screen, waitFor } from '@testing-library/react';
import { fakeApi, renderWithProviders } from '../testing/render';
import { LiveListener } from './live-updates';
import { useStores, useZoneSeries } from './queries';
import { isAffected, useLiveUpdates } from './use-live-updates';

describe('isAffected', () => {
  it('always refreshes the store list', () => {
    expect(isAffected(['stores', { page: 1 }], ['AMB-001'])).toBe(true);
  });

  it('refreshes zone queries only for the zones that changed', () => {
    expect(isAffected(['zone-series', 'AMB-001', '1d'], ['AMB-001'])).toBe(true);
    expect(isAffected(['zone-summary', 'AMB-002', '1d'], ['AMB-001'])).toBe(false);
    expect(isAffected(['zone-summary', 'AMB-002', '1d'], null)).toBe(true);
  });

  it('leaves the registry alone', () => {
    expect(isAffected(['customers'], null)).toBe(false);
    expect(isAffected([42], null)).toBe(false);
  });
});

function Probe() {
  const status = useLiveUpdates();
  useStores({
    period: '7d',
    sort: 'name',
    order: 'asc',
    page: 1,
    pageSize: 20,
  });
  useZoneSeries('AMB-001', '1d');
  useZoneSeries('AMB-002', '1d');
  return <output aria-label="live">{status}</output>;
}

function renderProbe() {
  let listener!: LiveListener;
  const unsubscribe = jest.fn();
  const api = fakeApi({
    subscribeToUpdates: jest.fn((l: LiveListener) => {
      listener = l;
      return unsubscribe;
    }),
  });
  const view = renderWithProviders(<Probe />, { api });
  return { api, view, unsubscribe, listener: () => listener };
}

const seriesCalls = (api: ReturnType<typeof fakeApi>, zoneId: string) =>
  api.zoneSeries.mock.calls.filter(([id]) => id === zoneId).length;

describe('useLiveUpdates', () => {
  it('exposes the connection status', () => {
    const { listener } = renderProbe();
    expect(screen.getByLabelText('live')).toHaveTextContent('connecting');

    act(() => listener().onStatus('open'));

    expect(screen.getByLabelText('live')).toHaveTextContent('open');
  });

  it('refetches the stores and the series of the zones that changed', async () => {
    const { api, listener } = renderProbe();
    await waitFor(() => expect(api.zoneSeries).toHaveBeenCalledTimes(2));

    act(() => listener().onUpdate({ referenceTime: null, zoneIds: ['AMB-001'] }));

    await waitFor(() => expect(api.listStores).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(seriesCalls(api, 'AMB-001')).toBe(2));
    expect(seriesCalls(api, 'AMB-002')).toBe(1);
  });

  it('refetches everything after a reconnection, since events may have been missed', async () => {
    const { api, listener } = renderProbe();
    await waitFor(() => expect(api.zoneSeries).toHaveBeenCalledTimes(2));

    act(() => listener().onStatus('open'));
    expect(api.listStores).toHaveBeenCalledTimes(1);
    act(() => listener().onStatus('reconnecting'));
    act(() => listener().onStatus('open'));

    await waitFor(() => expect(api.zoneSeries).toHaveBeenCalledTimes(4));
    expect(api.listStores).toHaveBeenCalledTimes(2);
  });

  it('closes the stream on unmount', () => {
    const { view, unsubscribe } = renderProbe();

    view.unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
