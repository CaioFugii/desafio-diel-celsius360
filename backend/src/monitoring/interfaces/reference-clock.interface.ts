/**
 * "Now" for every rule is the instant of the latest packet processed by the
 * ingestion, not the wall clock. Before any ingestion it falls back to the
 * wall clock, so periods are still well defined (and simply empty).
 */
export abstract class ReferenceClock {
  abstract now(): Promise<Date>;
}
