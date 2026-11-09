import { Controller, MessageEvent, Sse } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { LiveUpdatesService } from '../services/live-updates.service';

@ApiTags('tempo real')
@Controller('events')
export class LiveController {
  constructor(private readonly live: LiveUpdatesService) {}

  @Sse()
  @ApiOperation({
    summary: 'Atualizações da ingestão em tempo real (Server-Sent Events)',
    description:
      'Evento `ingestion` com `{ referenceTime, zoneIds }` a cada janela em que lotes foram gravados (`zoneIds: null` = qualquer ambiente). Evento `heartbeat` periódico mantém a conexão aberta. Os eventos indicam o que recarregar; não há replay: ao reconectar, o cliente deve recarregar tudo.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Fluxo text/event-stream' })
  events(): Observable<MessageEvent> {
    return this.live.events();
  }
}
