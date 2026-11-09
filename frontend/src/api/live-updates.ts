import { LiveStatus, LiveUpdate } from './types';

export interface LiveListener {
  onUpdate(update: LiveUpdate): void;
  onStatus(status: LiveStatus): void;
}

export type Unsubscribe = () => void;
export type SubscribeToUpdates = (listener: LiveListener) => Unsubscribe;

type EventSourceFactory = (url: string) => EventSource;

const RETRY_AFTER_CLOSE_MS = 5_000;
/** EventSource.CLOSED, spelled out so the module does not need the global at load time. */
const CLOSED = 2;

/**
 * EventSource reconnects by itself after network errors, but gives up for good
 * when the server answers with an error status (e.g. 502 while the API restarts),
 * so that case is retried here.
 */
export function createLiveUpdates(
  url: string,
  open: EventSourceFactory = (u) => new EventSource(u),
): SubscribeToUpdates {
  return (listener) => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      listener.onStatus('connecting');
      const current = open(url);
      source = current;
      current.onopen = () => listener.onStatus('open');
      current.addEventListener('ingestion', (event) => {
        listener.onUpdate(parseUpdate((event as MessageEvent<string>).data));
      });
      current.onerror = () => {
        listener.onStatus('reconnecting');
        if (current.readyState === CLOSED) {
          current.close();
          retry = setTimeout(connect, RETRY_AFTER_CLOSE_MS);
        }
      };
    };

    connect();
    return () => {
      clearTimeout(retry);
      source?.close();
    };
  };
}

function parseUpdate(data: string): LiveUpdate {
  try {
    const raw = JSON.parse(data) as Partial<LiveUpdate>;
    return {
      referenceTime: typeof raw.referenceTime === 'string' ? raw.referenceTime : null,
      zoneIds: Array.isArray(raw.zoneIds) ? raw.zoneIds : null,
    };
  } catch {
    return { referenceTime: null, zoneIds: null };
  }
}
