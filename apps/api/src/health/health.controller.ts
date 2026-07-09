import { Controller, Get, HttpCode } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../common/decorators';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness — prova que o processo está no ar. */
  @Get()
  @HttpCode(200)
  liveness() {
    return this.health.liveness();
  }

  /** Readiness — checa dependências (banco). */
  @Get('ready')
  @HttpCode(200)
  readiness() {
    return this.health.readiness();
  }
}
