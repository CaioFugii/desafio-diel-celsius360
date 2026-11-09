import { parseRegistry } from '../../src/registry/parsers/registry-file.parser';
import { PgRegistryWriter } from '../../src/registry/repositories/pg-registry.writer';
import { PgCustomersReader } from '../../src/registry/repositories/pg-customers.reader';
import { PgZoneDirectoryLoader } from '../../src/ingestion/repositories/pg-zone-directory.loader';
import { registryInput } from '../support/scenario';
import {
  TestDatabase,
  count,
  createTestDatabase,
} from '../support/test-database';

describe('registry persistence (PostgreSQL)', () => {
  let db: TestDatabase;
  let writer: PgRegistryWriter;

  beforeAll(async () => {
    db = await createTestDatabase('registry');
    writer = new PgRegistryWriter(db.pool);
  });

  afterAll(() => db.drop());

  it('stores every entity and is idempotent', async () => {
    await writer.save(parseRegistry(registryInput()));
    await writer.save(parseRegistry(registryInput()));

    expect(await count(db.pool, 'registry.customers')).toBe(2);
    expect(await count(db.pool, 'registry.stores')).toBe(5);
    expect(await count(db.pool, 'registry.zones')).toBe(25);
    expect(await count(db.pool, 'registry.devices')).toBe(25);
    expect(await count(db.pool, 'registry.users')).toBe(4);
    expect(await count(db.pool, 'registry.user_stores')).toBe(1);
  });

  it('updates changed entities, including devices swapped between zones', async () => {
    const input = registryInput();
    input.lojas[0].nome = 'Loja Tijuca (renovated)';
    input.ambientes[0].faixa_conforto_c = { min: 20, max: 24 };
    input.ambientes[0].dev_id = 'IOT002';
    input.ambientes[1].dev_id = 'IOT001';
    input.usuarios[2].lojas = ['LOJA-SP-001', 'LOJA-RJ-001'];

    await writer.save(parseRegistry(input));

    const { rows } = await db.pool.query(
      `SELECT z.id, z.comfort_min::float, z.comfort_max::float, d.id AS device, s.name AS store
       FROM registry.zones z
       JOIN registry.stores s ON s.id = z.store_id
       JOIN registry.devices d ON d.zone_id = z.id
       WHERE z.id IN ('AMB-001', 'AMB-002') ORDER BY z.id`,
    );
    expect(rows).toEqual([
      {
        id: 'AMB-001',
        comfort_min: 20,
        comfort_max: 24,
        device: 'IOT002',
        store: 'Loja Tijuca (renovated)',
      },
      {
        id: 'AMB-002',
        comfort_min: 21,
        comfort_max: 25,
        device: 'IOT001',
        store: 'Loja Tijuca (renovated)',
      },
    ]);
    expect(await count(db.pool, 'registry.user_stores')).toBe(2);
  });

  it('enforces the role scope rules in the database too', async () => {
    await expect(
      db.pool.query(
        `INSERT INTO registry.users (id, name, email, role, customer_id)
         VALUES ('X', 'X', 'x@x', 'gestor_cliente', NULL)`,
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it('lists customers with their store count', async () => {
    expect(await new PgCustomersReader(db.pool).list()).toEqual([
      {
        id: 'CLI-002',
        name: 'Banco Horizonte',
        segment: 'bancário',
        stores: 2,
      },
      {
        id: 'CLI-001',
        name: 'Moda Carioca',
        segment: 'varejo de moda',
        stores: 3,
      },
    ]);
  });

  it('loads the device -> zone directory used by the ingestion', async () => {
    await writer.save(parseRegistry(registryInput()));

    const directory = await new PgZoneDirectoryLoader(db.pool).load();

    expect(directory.size).toBe(25);
    const zone = directory.find('IOT014');
    expect(zone).toMatchObject({
      zoneId: 'AMB-014',
      band: { min: 21, max: 25 },
      timeZone: 'America/Recife',
    });
    expect(zone?.schedule.isOpen(0, 15 * 60)).toBe(true);
    expect(directory.find('IOT099')).toBeUndefined();
  });
});
