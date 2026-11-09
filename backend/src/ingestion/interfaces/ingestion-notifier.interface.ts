import { IngestionProgress } from '../../shared/events/ingestion-progress';

export abstract class IngestionNotifier {
  /** Best effort: a lost notification only delays the next screen refresh. */
  abstract batchCommitted(progress: IngestionProgress): Promise<void>;
}
