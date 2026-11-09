import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { withTransaction } from '../../database/transaction';
import { COMFORT_CODE } from '../../telemetry/domain/comfort';
import { latestPacketAt, summarizeDevices } from '../domain/device-state';
import {
  BatchPacket,
  Checkpoint,
  IngestionBatch,
  IngestionStore,
  InvalidLine,
} from '../interfaces/ingestion-store.interface';

interface CheckpointRow {
  source: string;
  last_line: number;
  reference_time: Date | null;
  started_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

// Postgres text cannot hold NUL bytes; a corrupted line must still be recorded.
const sanitize = (text: string) => text.replace(/\u0000/g, '');

@Injectable()
export class PgIngestionStore extends IngestionStore {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async checkpoint(source: string): Promise<Checkpoint | null> {
    const { rows } = await this.pool.query<CheckpointRow>(
      'SELECT * FROM ingestion.checkpoints WHERE source = $1',
      [source],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      source: row.source,
      lastLine: row.last_line,
      referenceTime: row.reference_time,
      startedAt: row.started_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  async markStarted(source: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ingestion.checkpoints (source, last_line) VALUES ($1, 0)
       ON CONFLICT (source) DO UPDATE SET started_at = now(), updated_at = now(), completed_at = NULL`,
      [source],
    );
  }

  async markCompleted(source: string): Promise<void> {
    await this.pool.query(
      'UPDATE ingestion.checkpoints SET completed_at = now(), updated_at = now() WHERE source = $1',
      [source],
    );
  }

  persist(batch: IngestionBatch): Promise<void> {
    return withTransaction(this.pool, async (tx) => {
      await this.insertRawPackets(tx, batch.source, batch.packets);
      await this.insertInvalidLines(tx, batch.source, batch.invalidLines);
      await this.insertSamples(tx, batch.packets);
      await this.insertRejectedSamples(tx, batch.packets);
      await this.upsertDeviceState(tx, batch.packets);
      await this.saveCheckpoint(tx, batch);
    });
  }

  private async insertRawPackets(
    tx: PoolClient,
    source: string,
    packets: BatchPacket[],
  ) {
    if (packets.length === 0) return;
    await tx.query(
      `INSERT INTO raw.packets (sent_at, device_id, source, line_no, payload)
       SELECT sent_at, device_id, $1, line_no, payload::jsonb
       FROM unnest($2::timestamptz[], $3::text[], $4::int[], $5::text[])
         AS t(sent_at, device_id, line_no, payload)
       ON CONFLICT DO NOTHING`,
      [
        source,
        packets.map((p) => p.enriched.packet.sentAt),
        packets.map((p) => p.enriched.packet.deviceId),
        packets.map((p) => p.lineNo),
        packets.map((p) => p.text),
      ],
    );
  }

  private async insertInvalidLines(
    tx: PoolClient,
    source: string,
    lines: InvalidLine[],
  ) {
    if (lines.length === 0) return;
    await tx.query(
      `INSERT INTO raw.rejected_lines (source, line_no, line, reason)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::text[])
       ON CONFLICT DO NOTHING`,
      [
        source,
        lines.map((l) => l.lineNo),
        lines.map((l) => sanitize(l.text)),
        lines.map((l) => l.reason),
      ],
    );
  }

  private async insertSamples(tx: PoolClient, packets: BatchPacket[]) {
    const samples = packets.flatMap((p) => p.enriched.samples);
    if (samples.length === 0) return;
    await tx.query(
      `INSERT INTO telemetry.samples (ts, device_id, zone_id, temperature, business_hours, comfort)
       SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::text[], $4::real[], $5::bool[], $6::smallint[])
       ON CONFLICT DO NOTHING`,
      [
        samples.map((s) => s.ts),
        samples.map((s) => s.deviceId),
        samples.map((s) => s.zoneId),
        samples.map((s) => s.temperature),
        samples.map((s) => s.businessHours),
        samples.map((s) => COMFORT_CODE[s.comfort]),
      ],
    );
  }

  private async insertRejectedSamples(tx: PoolClient, packets: BatchPacket[]) {
    const rejected = packets.flatMap((p) => p.enriched.rejected);
    if (rejected.length === 0) return;
    await tx.query(
      `INSERT INTO telemetry.rejected_samples (ts, device_id, temperature, reason)
       SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::float8[], $4::text[])
       ON CONFLICT DO NOTHING`,
      [
        rejected.map((r) => r.ts),
        rejected.map((r) => r.deviceId),
        rejected.map((r) => r.temperature),
        rejected.map((r) => r.reason),
      ],
    );
  }

  private async upsertDeviceState(tx: PoolClient, packets: BatchPacket[]) {
    const updates = summarizeDevices(packets);
    if (updates.length === 0) return;
    await tx.query(
      `INSERT INTO ingestion.device_state AS s
         (device_id, first_packet_at, last_packet_at, last_sample_at, last_temperature)
       SELECT * FROM unnest($1::text[], $2::timestamptz[], $3::timestamptz[], $4::timestamptz[], $5::real[])
       ON CONFLICT (device_id) DO UPDATE SET
         first_packet_at  = LEAST(s.first_packet_at, EXCLUDED.first_packet_at),
         last_packet_at   = GREATEST(s.last_packet_at, EXCLUDED.last_packet_at),
         last_sample_at   = GREATEST(s.last_sample_at, EXCLUDED.last_sample_at),
         last_temperature = CASE
           WHEN EXCLUDED.last_sample_at > s.last_sample_at OR s.last_sample_at IS NULL
             THEN COALESCE(EXCLUDED.last_temperature, s.last_temperature)
           ELSE s.last_temperature
         END,
         updated_at = now()`,
      [
        updates.map((u) => u.deviceId),
        updates.map((u) => u.firstPacketAt),
        updates.map((u) => u.lastPacketAt),
        updates.map((u) => u.lastSampleAt),
        updates.map((u) => u.lastTemperature),
      ],
    );
  }

  private async saveCheckpoint(tx: PoolClient, batch: IngestionBatch) {
    await tx.query(
      `INSERT INTO ingestion.checkpoints (source, last_line, reference_time)
       VALUES ($1, $2, $3)
       ON CONFLICT (source) DO UPDATE SET
         last_line = EXCLUDED.last_line,
         reference_time = GREATEST(ingestion.checkpoints.reference_time, EXCLUDED.reference_time),
         updated_at = now(),
         completed_at = NULL`,
      [batch.source, batch.lastLine, latestPacketAt(batch.packets)],
    );
  }
}
