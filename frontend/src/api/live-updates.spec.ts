import { LiveListener, createLiveUpdates } from './live-updates';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, (event: MessageEvent<string>) => void>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    this.listeners.set(type, handler);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: string) {
    this.listeners.get(type)?.({ data } as MessageEvent<string>);
  }
}

function setup() {
  FakeEventSource.instances = [];
  const listener: jest.Mocked<LiveListener> = {
    onUpdate: jest.fn(),
    onStatus: jest.fn(),
  };
  const subscribe = createLiveUpdates(
    '/api/events',
    (url) => new FakeEventSource(url) as unknown as EventSource,
  );
  const unsubscribe = subscribe(listener);
  return {
    listener,
    unsubscribe,
    source: () => FakeEventSource.instances.at(-1)!,
  };
}

describe('createLiveUpdates', () => {
  afterEach(() => jest.useRealTimers());

  it('connects to the events endpoint and reports the connection status', () => {
    const { listener, source } = setup();

    expect(source().url).toBe('/api/events');
    expect(listener.onStatus).toHaveBeenLastCalledWith('connecting');
    source().onopen?.();
    expect(listener.onStatus).toHaveBeenLastCalledWith('open');
  });

  it('forwards ingestion events', () => {
    const { listener, source } = setup();

    source().emit('ingestion', '{"referenceTime":"2026-02-10T12:00:00Z","zoneIds":["AMB-001"]}');
    source().emit('ingestion', '{"referenceTime":null,"zoneIds":null}');
    source().emit('ingestion', 'not json');

    expect(listener.onUpdate.mock.calls).toEqual([
      [{ referenceTime: '2026-02-10T12:00:00Z', zoneIds: ['AMB-001'] }],
      [{ referenceTime: null, zoneIds: null }],
      [{ referenceTime: null, zoneIds: null }],
    ]);
  });

  it('lets the browser reconnect after a network error', () => {
    const { listener, source } = setup();
    source().readyState = 0;

    source().onerror?.();

    expect(listener.onStatus).toHaveBeenLastCalledWith('reconnecting');
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('opens a new connection when the browser gave up', () => {
    jest.useFakeTimers();
    const { listener, source } = setup();
    const first = source();
    first.readyState = 2;

    first.onerror?.();
    expect(first.closed).toBe(true);
    jest.advanceTimersByTime(5_000);

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(listener.onStatus).toHaveBeenLastCalledWith('connecting');
  });

  it('closes the connection and cancels pending retries on unsubscribe', () => {
    jest.useFakeTimers();
    const { unsubscribe, source } = setup();
    source().readyState = 2;
    source().onerror?.();

    unsubscribe();
    jest.advanceTimersByTime(5_000);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(source().closed).toBe(true);
  });
});
