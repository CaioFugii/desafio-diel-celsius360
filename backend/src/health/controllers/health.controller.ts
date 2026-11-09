import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { HealthReport } from '../interfaces/health-report.interface';
import { HealthService } from '../services/health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOkResponse({ description: 'API e banco de dados disponíveis' })
  async check(): Promise<HealthReport> {
    const report = await this.health.check();
    if (report.status !== 'ok') throw new ServiceUnavailableException(report);
    return report;
  }
}
