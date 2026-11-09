import { EnrichedPacket } from './enriched-packet.interface';

export interface Checkpoint {
  source: string;
  lastLine: number;
  /** "Now" of the system: latest packet instant processed so far. */
  referenceTime: Date | null;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface BatchPacket {
  lineNo: number;
  text: string;
  enriched: EnrichedPacket;
}

export interface InvalidLine {
  lineNo: number;
  text: string;
  reason: string;
}

export interface IngestionBatch {
  source: string;
  lastLine: number;
  packets: BatchPacket[];
  invalidLines: InvalidLine[];
}

/**
 * Persistence port of the ingestion. `persist` must be atomic and idempotent:
 * a batch is fully stored with its checkpoint or not at all, and storing the
 * same lines again changes nothing.
 */
export abstract class IngestionStore {
  abstract checkpoint(source: string): Promise<Checkpoint | null>;
  abstract markStarted(source: string): Promise<void>;
  abstract persist(batch: IngestionBatch): Promise<void>;
  abstract markCompleted(source: string): Promise<void>;
}
