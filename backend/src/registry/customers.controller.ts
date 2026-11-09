import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerSummaryDto } from './customers.dto';
import { CustomersReader } from './customers.reader';

@ApiTags('cadastro')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersReader) {}

  @Get()
  @ApiOkResponse({
    type: [CustomerSummaryDto],
    description: 'Clientes com a quantidade de lojas',
  })
  list(): Promise<CustomerSummaryDto[]> {
    return this.customers.list();
  }
}
