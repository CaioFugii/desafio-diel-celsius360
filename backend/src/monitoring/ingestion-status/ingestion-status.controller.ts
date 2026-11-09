import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionStatusDto } from './ingestion-status.dto';
import { IngestionStatusReadModel } from './ingestion-status.read-model';

@ApiTags('ingestão')
@Controller('ingestion/status')
export class IngestionStatusController {
  constructor(private readonly readModel: IngestionStatusReadModel) {}

  @Get()
  @ApiOperation({
    summary: 'Progresso da ingestão, totais e dispositivos fora do cadastro',
  })
  @ApiOkResponse({ type: IngestionStatusDto })
  status(): Promise<IngestionStatusDto> {
    return this.readModel.status();
  }
}
