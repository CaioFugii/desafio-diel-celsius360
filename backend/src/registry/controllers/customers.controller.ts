import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerSummaryDto } from '../dto/customers.response.dto';
import { CustomersReader } from '../interfaces/customers-reader.interface';

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
