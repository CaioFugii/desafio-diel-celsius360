export interface IngestionOptions {
  batchSize: number;
  /** Ignore the checkpoint and replay the whole source (safe: writes are idempotent). */
  fromStart: boolean;
  /** Log progress every N processed lines. */
  progressEvery: number;
}

export interface IngestionReport {
  source: string;
  resumedAfterLine: number;
  lastLine: number;
  lines: number;
  packets: number;
  invalidLines: number;
  unknownDevicePackets: number;
  samples: number;
  rejectedSamples: number;
  referenceTime: Date | null;
  aborted: boolean;
}
