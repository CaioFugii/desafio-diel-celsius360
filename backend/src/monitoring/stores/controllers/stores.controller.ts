import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NetworkService } from '../services/network.service';
import { StoreListQueryDto } from '../dto/stores.query.dto';
import { StoreListResponseDto } from '../dto/stores.response.dto';

@ApiTags('rede')
@Controller('stores')
export class StoresController {
  constructor(private readonly network: NetworkService) {}

  @Get()
  @ApiOperation({
    summary: 'Lojas com status, ambientes e indicadores do período',
    description:
      'Filtros por cliente, busca e status; ordenação e paginação. "Agora" é o instante do último pacote ingerido.',
  })
  @ApiOkResponse({ type: StoreListResponseDto })
  list(@Query() query: StoreListQueryDto): Promise<StoreListResponseDto> {
    return this.network.list(query);
  }
}
