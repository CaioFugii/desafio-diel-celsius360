import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { TimeRange } from '../../../shared/time/time-range';
import { WeeklyHours } from '../../../shared/time/weekly-schedule';
import { ZONE_AGGREGATE } from '../../repositories/zone-aggregates';
import { Resolution } from '../../domain/resolution';
import {
  StoreFacts,
  StoreFilter,
  NetworkReadModel,
} from '../interfaces/network-read-model.interface';

interface Row {
  store_id: string;
  store_name: string;
  kind: string | null;
  city: string;
  state: string;
  timezone: string;
  customer_id: string;
  customer_name: string;
  zone_id: string | null;
  zone_name: string | null;
  comfort_min: string | null;
  comfort_max: string | null;
  business_hours: WeeklyHours | null;
  device_id: string | null;
  last_packet_at: Date | null;
  last_sample_at: Date | null;
  last_temperature: number | null;
  bh_samples: string;
  bh_within: string;
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class PgNetworkReadModel extends NetworkReadModel {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async storeFacts(
    filter: StoreFilter,
    range: TimeRange,
    resolution: Resolution,
  ): Promise<StoreFacts[]> {
    const { rows } = await this.pool.query<Row>(
      `WITH comfort AS (
         SELECT zone_id, sum(bh_samples) AS bh_samples, sum(bh_within) AS bh_within
         FROM ${ZONE_AGGREGATE[resolution]}
         WHERE bucket >= $1 AND bucket <= $2
         GROUP BY zone_id
       )
       SELECT s.id AS store_id, s.name AS store_name, s.kind, s.city, s.state, s.timezone,
              c.id AS customer_id, c.name AS customer_name,
              z.id AS zone_id, z.name AS zone_name, z.comfort_min, z.comfort_max, z.business_hours,
              d.id AS device_id, ds.last_packet_at, ds.last_sample_at, ds.last_temperature,
              coalesce(cf.bh_samples, 0) AS bh_samples, coalesce(cf.bh_within, 0) AS bh_within
       FROM registry.stores s
       JOIN registry.customers c ON c.id = s.customer_id
       LEFT JOIN registry.zones z ON z.store_id = s.id
       LEFT JOIN registry.devices d ON d.zone_id = z.id
       LEFT JOIN ingestion.device_state ds ON ds.device_id = d.id
       LEFT JOIN comfort cf ON cf.zone_id = z.id
       WHERE ($3::text IS NULL OR s.customer_id = $3)
         AND ($4::text IS NULL OR s.name ILIKE $4 OR s.city ILIKE $4 OR s.id ILIKE $4)
       ORDER BY s.id, z.id`,
      [
        range.from,
        range.to,
        filter.customerId ?? null,
        filter.search ? `%${escapeLike(filter.search)}%` : null,
      ],
    );
    return groupByStore(rows);
  }
}

function groupByStore(rows: Row[]): StoreFacts[] {
  const stores = new Map<string, StoreFacts>();
  for (const r of rows) {
    let store = stores.get(r.store_id);
    if (!store) {
      store = {
        id: r.store_id,
        name: r.store_name,
        kind: r.kind,
        city: r.city,
        state: r.state,
        timezone: r.timezone,
        customer: { id: r.customer_id, name: r.customer_name },
        zones: [],
      };
      stores.set(r.store_id, store);
    }
    if (r.zone_id === null) continue;
    store.zones.push({
      id: r.zone_id,
      name: r.zone_name ?? '',
      deviceId: r.device_id,
      band: { min: Number(r.comfort_min), max: Number(r.comfort_max) },
      businessHours: r.business_hours as WeeklyHours,
      lastPacketAt: r.last_packet_at,
      lastSampleAt: r.last_sample_at,
      lastTemperature: r.last_temperature,
      businessHoursSamples: Number(r.bh_samples),
      withinSamples: Number(r.bh_within),
    });
  }
  return [...stores.values()];
}
