import { Module } from '@nestjs/common';
import { CustomersController } from './controllers/customers.controller';
import { CustomersReader } from './interfaces/customers-reader.interface';
import { PgCustomersReader } from './repositories/pg-customers.reader';

@Module({
  controllers: [CustomersController],
  providers: [{ provide: CustomersReader, useClass: PgCustomersReader }],
})
export class RegistryModule {}
