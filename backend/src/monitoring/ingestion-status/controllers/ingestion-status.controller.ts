import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IngestionStatusDto } from '../dto/ingestion-status.response.dto';
import { IngestionStatusReadModel } from '../interfaces/ingestion-status-read-model.interface';

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
