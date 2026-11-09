import { IngestionProgress } from '../../shared/events/ingestion-progress';

/** What the screens need to know to refresh: the new "now" and which zones changed. */
export interface LiveUpdate {
  referenceTime: Date | null;
  /** null means any zone may have changed. */
  zoneIds: string[] | null;
}

/** Folds the batches committed within a window into a single update. */
export function mergeProgress(
  events: readonly IngestionProgress[],
): LiveUpdate {
  let referenceTime: Date | null = null;
  let zones: Set<string> | null = new Set();
  for (const event of events) {
    if (
      event.referenceTime &&
      (!referenceTime || event.referenceTime > referenceTime)
    ) {
      referenceTime = event.referenceTime;
    }
    if (event.zoneIds === null) zones = null;
    else if (zones) for (const zone of event.zoneIds) zones.add(zone);
  }
  return { referenceTime, zoneIds: zones ? [...zones].sort() : null };
}
