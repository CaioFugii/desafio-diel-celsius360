import { ApiProperty } from '@nestjs/swagger';

export class CustomerSummaryDto {
  @ApiProperty({ example: 'CLI-001' })
  id: string;

  @ApiProperty({ example: 'Moda Carioca' })
  name: string;

  @ApiProperty({ example: 'varejo de moda', nullable: true, type: String })
  segment: string | null;

  @ApiProperty({ example: 3 })
  stores: number;
}
