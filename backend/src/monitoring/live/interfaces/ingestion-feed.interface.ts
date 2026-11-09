import { Observable } from 'rxjs';
import { IngestionProgress } from '../../../shared/events/ingestion-progress';

export abstract class IngestionFeed {
  /** Hot stream of committed batches, shared by every subscriber. */
  abstract progress(): Observable<IngestionProgress>;
}
