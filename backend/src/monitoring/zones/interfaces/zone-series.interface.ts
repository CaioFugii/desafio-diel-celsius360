import { ComfortBand } from '../../../telemetry/domain/comfort';
import { Resolution } from '../../domain/resolution';
import { Gap, SeriesPoint } from './zones-read-model.interface';

export interface ZoneSeries {
  zoneId: string;
  from: Date;
  to: Date;
  resolution: Resolution;
  bucketSeconds: number;
  comfortBand: ComfortBand;
  points: SeriesPoint[];
  /** Periods of at least the offline threshold without valid readings. */
  gaps: Gap[];
}
