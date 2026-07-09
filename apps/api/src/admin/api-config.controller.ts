import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { AI_CREDITS, getEnv } from '@eduforge/config';

const rateLimitSchema = z.object({
  maxRequestsPerMinute: z.number().int().min(1).max(10000).default(60),
  windowSeconds: z.number().int().min(10).max(3600).default(60),
});

const aiCreditsSchema = z.object({
  costPerInteraction: z.number().int().min(1).default(3),
  costTutorQuestion: z.number().int().min(1).default(1),
  costPodcast: z.number().int().min(1).default(5),
  costIllustration: z.number().int().min(1).default(2),
  lowBalanceThreshold: z.number().int().min(1).default(30),
});

@Controller('admin/config')
export class ApiConfigController {
  /** Configuração atual de rate limiting */
  @Get('rate-limit')
  @Roles('admin', 'super_admin')
  getRateLimit() {
    return {
      maxRequestsPerMinute: 60,
      windowSeconds: 60,
      description: 'Aplicado via GlobalRateLimitGuard em todas as requisições.',
    };
  }

  /** Configuração atual de custos de créditos */
  @Get('ai-credits')
  @Roles('admin', 'super_admin')
  getAiCredits() {
    return {
      ...AI_CREDITS,
      description: 'Custos de crédito por operação de IA.',
    };
  }

  /** Configuração atual do ambiente */
  @Get('environment')
  @Roles('admin', 'super_admin')
  getEnvironment() {
    const env = getEnv();
    return {
      nodeEnv: env.NODE_ENV,
      aiProvider: env.AI_PROVIDER,
      mailer: env.MAILER ?? 'console',
      appBaseUrl: env.APP_BASE_URL,
      adminBaseUrl: env.ADMIN_BASE_URL,
      runtimeBaseUrl: env.RUNTIME_BASE_URL,
      corsOrigins: [env.APP_BASE_URL, env.ADMIN_BASE_URL, env.RUNTIME_BASE_URL],
      inpiGruFeeCents: env.INPI_GRU_FEE_CENTS ?? 21000,
      inpiServiceFeeCents: env.INPI_SERVICE_FEE_CENTS ?? 29700,
    };
  }

  /** Endpoints da API registrados */
  @Get('routes')
  @Roles('admin', 'super_admin')
  getRoutes() {
    // Retorna os escopos disponíveis e as filas
    return {
      scopes: [
        'projects:read', 'projects:write',
        'content:read', 'content:write',
        'design:read', 'design:write',
        'ai:invoke',
        'publish',
        'analytics:read',
        'learners:read', 'learners:write',
        'inpi:read', 'inpi:write',
        'billing:read',
        'jobs:read',
      ],
      queues: ['ingest', 'generate', 'tts', 'inpi-package', 'sensei-embed', 'webhook-delivery'],
      totalEndpoints: '~60 (ver OpenAPI /v1/openapi.json)',
    };
  }
}
