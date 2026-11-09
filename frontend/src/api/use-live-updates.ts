import { QueryClient, QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useApi } from './api-context';
import { LiveStatus } from './types';

const ZONE_QUERIES = new Set(['zone-summary', 'zone-series']);

/** Whether a cached query may be stale after an update touching these zones (null = all). */
export function isAffected(queryKey: QueryKey, zoneIds: readonly string[] | null): boolean {
  const [kind, zoneId] = queryKey;
  if (kind === 'stores') return true;
  if (typeof kind !== 'string' || !ZONE_QUERIES.has(kind)) return false;
  return zoneIds === null || zoneIds.includes(zoneId as string);
}

function refresh(client: QueryClient, zoneIds: readonly string[] | null): void {
  // an in-flight request is not restarted, so slow queries are not starved by frequent updates
  void client.invalidateQueries(
    { predicate: (query) => isAffected(query.queryKey, zoneIds) },
    { cancelRefetch: false },
  );
}

/** Keeps the screens in sync with the ingestion while it runs. */
export function useLiveUpdates(): LiveStatus {
  const api = useApi();
  const client = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    let missedEvents = false;
    return api.subscribeToUpdates({
      onUpdate: (update) => refresh(client, update.zoneIds),
      onStatus: (next) => {
        setStatus(next);
        if (next === 'reconnecting') missedEvents = true;
        if (next === 'open' && missedEvents) {
          missedEvents = false;
          refresh(client, null);
        }
      },
    });
  }, [api, client]);

  return status;
}
