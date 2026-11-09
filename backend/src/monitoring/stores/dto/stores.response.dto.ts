import { ApiProperty } from '@nestjs/swagger';
import {
  DEVICE_STATUSES,
  DeviceStatus,
  STORE_STATUSES,
  StoreStatus,
  ZONE_CONDITIONS,
  ZoneCondition,
} from '../../domain/status';
import {
  ComfortBandDto,
  PeriodDto,
  RefDto,
} from '../../dto/common.response.dto';
import {
  NetworkSummary,
  StoreListResult,
  StoreView,
  ZoneView,
} from '../interfaces/network.interface';

export class ZoneStatusDto implements ZoneView {
  @ApiProperty({ example: 'AMB-001' }) id: string;
  @ApiProperty({ example: 'Salão de vendas - Vitrine' }) name: string;
  @ApiProperty({ example: 'IOT001', nullable: true, type: String }) deviceId:
    string | null;
  @ApiProperty({ enum: DEVICE_STATUSES }) deviceStatus: DeviceStatus;

  @ApiProperty({
    enum: ZONE_CONDITIONS,
    description:
      'Situação atual: na faixa, abaixo, acima, fora do horário ou desconhecida',
  })
  condition: ZoneCondition;

  @ApiProperty({ description: 'Dentro do horário de funcionamento agora' })
  isOpen: boolean;
  @ApiProperty({ nullable: true, type: Number }) currentTemperature:
    number | null;
  @ApiProperty({ nullable: true, type: Date }) lastReadingAt: Date | null;
  @ApiProperty({ type: ComfortBandDto }) comfortBand: ComfortBandDto;

  @ApiProperty({
    nullable: true,
    type: Number,
    description:
      '% das leituras no horário de funcionamento dentro da faixa, no período',
  })
  comfortPct: number | null;
}

export class StoreDto implements StoreView {
  @ApiProperty({ example: 'LOJA-SP-001' }) id: string;
  @ApiProperty({ example: 'Loja Paulista' }) name: string;
  @ApiProperty({ nullable: true, type: String }) kind: string | null;
  @ApiProperty({ example: 'São Paulo' }) city: string;
  @ApiProperty({ example: 'SP' }) state: string;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone: string;
  @ApiProperty({ type: RefDto }) customer: RefDto;
  @ApiProperty({ enum: STORE_STATUSES }) status: StoreStatus;
  @ApiProperty({ nullable: true, type: Number }) comfortPct: number | null;
  @ApiProperty() zonesTotal: number;
  @ApiProperty() zonesOnline: number;
  @ApiProperty({
    description: 'Ambientes abertos com leitura atual fora da faixa',
  })
  zonesOutOfRange: number;
  @ApiProperty({ type: [ZoneStatusDto] }) zones: ZoneStatusDto[];
}

export class StoresByStatusDto implements Record<StoreStatus, number> {
  @ApiProperty() online: number;
  @ApiProperty() partial: number;
  @ApiProperty() offline: number;
  @ApiProperty() no_data: number;
}

export class NetworkSummaryDto implements NetworkSummary {
  @ApiProperty() stores: number;
  @ApiProperty() zones: number;
  @ApiProperty() zonesOnline: number;
  @ApiProperty() zonesOutOfRange: number;
  @ApiProperty({ nullable: true, type: Number }) comfortPct: number | null;
  @ApiProperty({ type: StoresByStatusDto }) storesByStatus: StoresByStatusDto;
}

export class StoreListResponseDto implements StoreListResult {
  @ApiProperty({
    description: 'Instante do último pacote processado ("agora")',
  })
  referenceTime: Date;
  @ApiProperty({ type: PeriodDto }) period: PeriodDto;

  @ApiProperty({
    type: NetworkSummaryDto,
    description:
      'Totais com os filtros de cliente e busca, antes do filtro de status',
  })
  summary: NetworkSummaryDto;

  @ApiProperty() page: number;
  @ApiProperty() pageSize: number;
  @ApiProperty({ description: 'Lojas que atendem a todos os filtros' })
  total: number;
  @ApiProperty({ type: [StoreDto] }) items: StoreDto[];
}
