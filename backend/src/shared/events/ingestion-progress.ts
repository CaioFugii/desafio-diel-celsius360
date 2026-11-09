/** Postgres NOTIFY channel the ingestion publishes to after each committed batch. */
export const INGESTION_PROGRESS_CHANNEL = 'ingestion_progress';

/** NOTIFY payloads are limited to 8000 bytes; past this many zones, "all zones" is sent instead. */
export const MAX_ZONES_PER_EVENT = 300;

export interface IngestionProgress {
  source: string;
  lastLine: number;
  /** Instant of the latest packet ingested so far (the system's "now"). */
  referenceTime: Date | null;
  /** Zones that received packets; null means any zone may have changed. */
  zoneIds: string[] | null;
}

export function encodeProgress(progress: IngestionProgress): string {
  const zoneIds =
    progress.zoneIds && progress.zoneIds.length <= MAX_ZONES_PER_EVENT
      ? progress.zoneIds
      : null;
  return JSON.stringify({
    source: progress.source,
    lastLine: progress.lastLine,
    referenceTime: progress.referenceTime?.toISOString() ?? null,
    zoneIds,
  });
}

/** Returns null for payloads that do not follow the contract. */
export function decodeProgress(payload: string): IngestionProgress | null {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { source, lastLine, referenceTime, zoneIds } = raw as Record<
    string,
    unknown
  >;
  if (typeof source !== 'string' || typeof lastLine !== 'number') return null;
  const time =
    typeof referenceTime === 'string' ? new Date(referenceTime) : null;
  if (time && Number.isNaN(time.getTime())) return null;
  const zones =
    Array.isArray(zoneIds) && zoneIds.every((z) => typeof z === 'string')
      ? zoneIds
      : null;
  return { source, lastLine, referenceTime: time, zoneIds: zones };
}
