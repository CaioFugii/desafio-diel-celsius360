import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.module';
import { withTransaction } from '../database/transaction';
import { Registry } from './registry.types';

export abstract class RegistryWriter {
  /** Inserts or updates every entity; running it twice leaves the same state. */
  abstract save(registry: Registry): Promise<void>;
}

@Injectable()
export class PgRegistryWriter extends RegistryWriter {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  save(registry: Registry): Promise<void> {
    return withTransaction(this.pool, async (tx) => {
      await this.saveCustomers(tx, registry);
      await this.saveStores(tx, registry);
      await this.saveZones(tx, registry);
      await this.saveDevices(tx, registry);
      await this.saveUsers(tx, registry);
    });
  }

  private async saveCustomers(tx: PoolClient, { customers }: Registry) {
    await tx.query(
      `INSERT INTO registry.customers (id, name, segment)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, segment = EXCLUDED.segment`,
      [
        customers.map((c) => c.id),
        customers.map((c) => c.name),
        customers.map((c) => c.segment),
      ],
    );
  }

  private async saveStores(tx: PoolClient, { stores }: Registry) {
    await tx.query(
      `INSERT INTO registry.stores
         (id, customer_id, name, kind, city, state, latitude, longitude, timezone, business_hours)
       SELECT id, customer_id, name, kind, city, state, latitude, longitude, timezone, hours::jsonb
       FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[],
                   $7::float8[], $8::float8[], $9::text[], $10::text[])
         AS t(id, customer_id, name, kind, city, state, latitude, longitude, timezone, hours)
       ON CONFLICT (id) DO UPDATE SET
         customer_id = EXCLUDED.customer_id, name = EXCLUDED.name, kind = EXCLUDED.kind,
         city = EXCLUDED.city, state = EXCLUDED.state, latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude, timezone = EXCLUDED.timezone,
         business_hours = EXCLUDED.business_hours`,
      [
        stores.map((s) => s.id),
        stores.map((s) => s.customerId),
        stores.map((s) => s.name),
        stores.map((s) => s.kind),
        stores.map((s) => s.city),
        stores.map((s) => s.state),
        stores.map((s) => s.latitude),
        stores.map((s) => s.longitude),
        stores.map((s) => s.timezone),
        stores.map((s) => JSON.stringify(s.businessHours)),
      ],
    );
  }

  private async saveZones(tx: PoolClient, { zones }: Registry) {
    await tx.query(
      `INSERT INTO registry.zones (id, store_id, name, comfort_min, comfort_max, business_hours)
       SELECT id, store_id, name, cmin, cmax, hours::jsonb
       FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::text[])
         AS t(id, store_id, name, cmin, cmax, hours)
       ON CONFLICT (id) DO UPDATE SET
         store_id = EXCLUDED.store_id, name = EXCLUDED.name,
         comfort_min = EXCLUDED.comfort_min, comfort_max = EXCLUDED.comfort_max,
         business_hours = EXCLUDED.business_hours`,
      [
        zones.map((z) => z.id),
        zones.map((z) => z.storeId),
        zones.map((z) => z.name),
        zones.map((z) => z.comfortBand.min),
        zones.map((z) => z.comfortBand.max),
        zones.map((z) => JSON.stringify(z.businessHours)),
      ],
    );
  }

  private async saveDevices(tx: PoolClient, { zones }: Registry) {
    const installed = zones.filter((z) => z.deviceId !== null);
    // Detach first so a device moving between zones never violates UNIQUE(zone_id).
    await tx.query(
      `UPDATE registry.devices SET zone_id = NULL
       WHERE zone_id = ANY($1::text[]) OR id = ANY($2::text[])`,
      [installed.map((z) => z.id), installed.map((z) => z.deviceId)],
    );
    await tx.query(
      `INSERT INTO registry.devices (id, zone_id)
       SELECT * FROM unnest($1::text[], $2::text[])
       ON CONFLICT (id) DO UPDATE SET zone_id = EXCLUDED.zone_id`,
      [installed.map((z) => z.deviceId), installed.map((z) => z.id)],
    );
  }

  private async saveUsers(tx: PoolClient, { users }: Registry) {
    await tx.query(
      `INSERT INTO registry.users (id, name, email, role, customer_id)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[])
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name, email = EXCLUDED.email,
         role = EXCLUDED.role, customer_id = EXCLUDED.customer_id`,
      [
        users.map((u) => u.id),
        users.map((u) => u.name),
        users.map((u) => u.email),
        users.map((u) => u.role),
        users.map((u) => u.customerId),
      ],
    );
    await tx.query(
      'DELETE FROM registry.user_stores WHERE user_id = ANY($1::text[])',
      [users.map((u) => u.id)],
    );
    const links = users.flatMap((u) =>
      u.storeIds.map((storeId) => ({ userId: u.id, storeId })),
    );
    await tx.query(
      `INSERT INTO registry.user_stores (user_id, store_id)
       SELECT * FROM unnest($1::text[], $2::text[])`,
      [links.map((l) => l.userId), links.map((l) => l.storeId)],
    );
  }
}
