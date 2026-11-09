import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersReader, PgCustomersReader } from './customers.reader';

@Module({
  controllers: [CustomersController],
  providers: [{ provide: CustomersReader, useClass: PgCustomersReader }],
})
export class RegistryModule {}
