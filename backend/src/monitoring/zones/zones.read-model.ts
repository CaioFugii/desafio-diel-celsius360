import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import { TimeRange } from '../../shared/time/time-range';
import { WeeklyHours } from '../../shared/time/weekly-schedule';
import { ZONE_AGGREGATE } from '../aggregates';
import { Resolution } from '../domain/resolution';
import { ZoneLiveFacts } from '../domain/zone-evaluation';

export interface ZoneDetails extends ZoneLiveFacts {
  id: string;
  name: string;
  store: {
    id: string;
    name: string;
    city: string;
    state: string;
    timezone: string;
  };
  customer: { id: string; name: string };
}

export interface SeriesPoint {
  t: Date;
  avg: number;
  min: number;
  max: number;
  samples: number;
}

export interface PeriodStats {
  samples: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  businessHoursSamples: number;
  within: number;
  below: number;
  above: number;
}

export interface Gap {
  from: Date;
  to: Date;
}

export abstract class ZonesReadModel {
  abstract findZone(zoneId: string): Promise<ZoneDetails | null>;
  abstract series(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<SeriesPoint[]>;
  abstract stats(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<PeriodStats>;
  /**
   * Ranges are closed on both ends: the bucket holding the reference "now" belongs to
   * the period. Gaps are intervals of at least `minGapMs` without a valid reading,
   * including a missing start or end of the range.
   */
  abstract gaps(
    zoneId: string,
    range: TimeRange,
    minGapMs: number,
  ): Promise<Gap[]>;
  abstract rejectedReadings(zoneId: string, range: TimeRange): Promise<number>;
}

const toNumber = (v: string | number | null) => (v === null ? null : Number(v));

@Injectable()
export class PgZonesReadModel extends ZonesReadModel {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async findZone(zoneId: string): Promise<ZoneDetails | null> {
    const { rows } = await this.pool.query(
      `SELECT z.id, z.name, z.comfort_min, z.comfort_max, z.business_hours,
              s.id AS store_id, s.name AS store_name, s.city, s.state, s.timezone,
              c.id AS customer_id, c.name AS customer_name,
              d.id AS device_id, ds.last_packet_at, ds.last_sample_at, ds.last_temperature
       FROM registry.zones z
       JOIN registry.stores s ON s.id = z.store_id
       JOIN registry.customers c ON c.id = s.customer_id
       LEFT JOIN registry.devices d ON d.zone_id = z.id
       LEFT JOIN ingestion.device_state ds ON ds.device_id = d.id
       WHERE z.id = $1`,
      [zoneId],
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      band: { min: Number(r.comfort_min), max: Number(r.comfort_max) },
      businessHours: r.business_hours as WeeklyHours,
      deviceId: r.device_id,
      lastPacketAt: r.last_packet_at,
      lastSampleAt: r.last_sample_at,
      lastTemperature: r.last_temperature,
      store: {
        id: r.store_id,
        name: r.store_name,
        city: r.city,
        state: r.state,
        timezone: r.timezone,
      },
      customer: { id: r.customer_id, name: r.customer_name },
    };
  }

  async series(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<SeriesPoint[]> {
    const { rows } = await this.pool.query(
      `SELECT bucket AS t, sum_t / samples AS avg, min_t AS min, max_t AS max, samples
       FROM ${ZONE_AGGREGATE[resolution]}
       WHERE zone_id = $1 AND bucket >= $2 AND bucket <= $3 AND samples > 0
       ORDER BY bucket`,
      [zoneId, range.from, range.to],
    );
    return rows.map((r) => ({
      t: r.t,
      avg: Math.round(Number(r.avg) * 100) / 100,
      min: Number(r.min),
      max: Number(r.max),
      samples: Number(r.samples),
    }));
  }

  async stats(
    zoneId: string,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<PeriodStats> {
    const { rows } = await this.pool.query(
      `SELECT coalesce(sum(samples), 0) AS samples,
              sum(sum_t) / nullif(sum(samples), 0) AS avg,
              min(min_t) AS min, max(max_t) AS max,
              coalesce(sum(bh_samples), 0) AS bh_samples,
              coalesce(sum(bh_within), 0) AS within,
              coalesce(sum(bh_below), 0) AS below,
              coalesce(sum(bh_above), 0) AS above
       FROM ${ZONE_AGGREGATE[resolution]}
       WHERE zone_id = $1 AND bucket >= $2 AND bucket <= $3`,
      [zoneId, range.from, range.to],
    );
    const r = rows[0];
    const avg = toNumber(r.avg);
    return {
      samples: Number(r.samples),
      avg: avg === null ? null : Math.round(avg * 100) / 100,
      min: toNumber(r.min),
      max: toNumber(r.max),
      businessHoursSamples: Number(r.bh_samples),
      within: Number(r.within),
      below: Number(r.below),
      above: Number(r.above),
    };
  }

  async gaps(
    zoneId: string,
    range: TimeRange,
    minGapMs: number,
  ): Promise<Gap[]> {
    // Each 1-minute bucket with data covers [bucket, bucket + 1 min). Sentinels at the
    // range edges turn a missing start or end into a regular gap.
    const { rows } = await this.pool.query<{ from: Date; to: Date }>(
      `WITH covered AS (
         SELECT $2::timestamptz AS starts, $2::timestamptz AS ends
         UNION ALL
         SELECT bucket, bucket + INTERVAL '1 minute'
         FROM telemetry.zone_1m
         WHERE zone_id = $1 AND bucket >= $2 AND bucket <= $3 AND samples > 0
         UNION ALL
         SELECT $3::timestamptz, $3::timestamptz
       ), ordered AS (
         SELECT starts, lag(ends) OVER (ORDER BY starts, ends) AS previous_end
         FROM covered
       )
       SELECT previous_end AS "from", starts AS "to"
       FROM ordered
       WHERE previous_end IS NOT NULL
         AND starts - previous_end >= $4 * INTERVAL '1 millisecond'
       ORDER BY previous_end`,
      [zoneId, range.from, range.to, minGapMs],
    );
    return rows;
  }

  async rejectedReadings(zoneId: string, range: TimeRange): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) FROM telemetry.rejected_samples r
       JOIN registry.devices d ON d.id = r.device_id
       WHERE d.zone_id = $1 AND r.ts >= $2 AND r.ts <= $3`,
      [zoneId, range.from, range.to],
    );
    return Number(rows[0].count);
  }
}
