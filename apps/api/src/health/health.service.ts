import { Injectable } from '@nestjs/common';
import { prisma } from '@eduforge/db';
import { checkReadiness, type ReadinessReport } from './health.logic';

@Injectable()
export class HealthService {
  liveness(): { status: 'ok'; service: string; uptime: number } {
    return { status: 'ok', service: 'api', uptime: process.uptime() };
  }

  readiness(): Promise<ReadinessReport> {
    return checkReadiness(prisma);
  }
}
