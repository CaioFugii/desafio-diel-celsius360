import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import {
  SourceProgress,
  IngestionStatus,
  IngestionStatusReadModel,
} from '../interfaces/ingestion-status-read-model.interface';

@Injectable()
export class PgIngestionStatusReadModel extends IngestionStatusReadModel {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async status(): Promise<IngestionStatus> {
    const [sources, totals, unregistered] = await Promise.all([
      this.pool.query(
        `SELECT source, last_line, reference_time, started_at, updated_at, completed_at
         FROM ingestion.checkpoints ORDER BY source`,
      ),
      this.pool.query(
        `SELECT (SELECT count(*) FROM raw.packets) AS raw_packets,
                (SELECT count(*) FROM telemetry.samples) AS samples,
                (SELECT count(*) FROM telemetry.rejected_samples) AS rejected,
                (SELECT count(*) FROM raw.rejected_lines) AS invalid_lines`,
      ),
      this.pool.query<{ device_id: string }>(
        `SELECT ds.device_id FROM ingestion.device_state ds
         LEFT JOIN registry.devices d ON d.id = ds.device_id
         WHERE d.zone_id IS NULL ORDER BY ds.device_id`,
      ),
    ]);
    const progress: SourceProgress[] = sources.rows.map((r) => ({
      source: r.source,
      lastLine: r.last_line,
      referenceTime: r.reference_time,
      startedAt: r.started_at,
      updatedAt: r.updated_at,
      completedAt: r.completed_at,
    }));
    const t = totals.rows[0];
    return {
      referenceTime: progress.reduce<Date | null>(
        (max, s) =>
          s.referenceTime && (!max || s.referenceTime > max)
            ? s.referenceTime
            : max,
        null,
      ),
      sources: progress,
      totals: {
        rawPackets: Number(t.raw_packets),
        samples: Number(t.samples),
        rejectedReadings: Number(t.rejected),
        invalidLines: Number(t.invalid_lines),
      },
      unregisteredDevices: unregistered.rows.map((r) => r.device_id),
    };
  }
}
