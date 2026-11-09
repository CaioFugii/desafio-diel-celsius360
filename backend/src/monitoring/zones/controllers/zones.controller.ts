import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZoneSeriesService } from '../services/zone-series.service';
import { ZoneSummaryService } from '../services/zone-summary.service';
import { SeriesQueryDto, SummaryQueryDto } from '../dto/zones.query.dto';
import { ZoneSeriesDto, ZoneSummaryDto } from '../dto/zones.response.dto';

@ApiTags('ambientes')
@Controller('zones/:zoneId')
@ApiNotFoundResponse({ description: 'Ambiente inexistente' })
export class ZonesController {
  constructor(
    private readonly seriesService: ZoneSeriesService,
    private readonly summaryService: ZoneSummaryService,
  ) {}

  @Get('series')
  @ApiOperation({
    summary: 'Série de temperatura do ambiente num intervalo',
    description:
      'A agregação (1 min, 15 min ou 1 h) é escolhida pelo tamanho do intervalo.',
  })
  @ApiOkResponse({ type: ZoneSeriesDto })
  @ApiBadRequestResponse({
    description: 'Intervalo inválido ou maior que 92 dias',
  })
  series(
    @Param('zoneId') zoneId: string,
    @Query() query: SeriesQueryDto,
  ): Promise<ZoneSeriesDto> {
    return this.seriesService.series(zoneId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo do ambiente: situação atual e indicadores do período',
  })
  @ApiOkResponse({ type: ZoneSummaryDto })
  summary(
    @Param('zoneId') zoneId: string,
    @Query() query: SummaryQueryDto,
  ): Promise<ZoneSummaryDto> {
    return this.summaryService.summary(zoneId, query.period);
  }
}
