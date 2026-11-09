import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import {
  CustomerSummary,
  CustomersReader,
} from '../interfaces/customers-reader.interface';

@Injectable()
export class PgCustomersReader extends CustomersReader {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async list(): Promise<CustomerSummary[]> {
    const { rows } = await this.pool.query<CustomerSummary>(
      `SELECT c.id, c.name, c.segment, count(s.id)::int AS stores
       FROM registry.customers c
       LEFT JOIN registry.stores s ON s.customer_id = c.id
       GROUP BY c.id
       ORDER BY c.name`,
    );
    return rows;
  }
}
