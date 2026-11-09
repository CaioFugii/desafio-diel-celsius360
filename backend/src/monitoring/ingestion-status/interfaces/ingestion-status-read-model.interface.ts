export interface SourceProgress {
  source: string;
  lastLine: number;
  referenceTime: Date | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface IngestionStatus {
  referenceTime: Date | null;
  sources: SourceProgress[];
  totals: {
    rawPackets: number;
    samples: number;
    rejectedReadings: number;
    invalidLines: number;
  };
  /** Devices that sent packets but are not in the registry (raw kept, no series). */
  unregisteredDevices: string[];
}

export abstract class IngestionStatusReadModel {
  abstract status(): Promise<IngestionStatus>;
}
