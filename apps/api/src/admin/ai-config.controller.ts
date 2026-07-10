import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { SHARED_REDIS } from '../common/redis.module';
import { getEnv } from '@eduforge/config';

@Controller('admin/ai-config')
export class AiConfigController {
  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  @Get()
  @Roles('admin', 'super_admin')
  async getConfig() {
    const env = getEnv();
    const [anthropicKey, openaiKey, googleKey] = await Promise.all([
      this.redis.get('ai:anthropic_key'),
      this.redis.get('ai:openai_key'),
      this.redis.get('ai:google_key'),
    ]);

    return {
      provider: env.AI_PROVIDER,
      models: {
        structure: env.AI_MODEL_STRUCTURE ?? 'claude-sonnet-5',
        interactions: env.AI_MODEL_INTERACTIONS ?? 'claude-sonnet-5',
        tutor: env.AI_MODEL_STRUCTURE ?? 'claude-sonnet-5',
      },
      keys: {
        anthropic: anthropicKey ? mask(anthropicKey) : (env.ANTHROPIC_API_KEY ? mask(env.ANTHROPIC_API_KEY) : null),
        openai: openaiKey ? mask(openaiKey) : null,
        google: googleKey ? mask(googleKey) : null,
      },
      keysSource: {
        anthropic: anthropicKey ? 'redis' : env.ANTHROPIC_API_KEY ? 'env' : 'none',
        openai: openaiKey ? 'redis' : 'none',
        google: googleKey ? 'redis' : 'none',
      },
      note: 'Chaves no Redis têm precedência sobre .env. Altere aqui sem reiniciar a API.',
    };
  }

  @Post('key')
  @Roles('admin', 'super_admin')
  async setKey(@Body() body: { provider: string; apiKey: string }) {
    if (!body.apiKey || !body.provider) return { error: 'provider e apiKey são obrigatórios' };
    await this.redis.set(`ai:${body.provider}_key`, body.apiKey);
    return { saved: true, provider: body.provider, preview: mask(body.apiKey) };
  }

  @Post('key/clear')
  @Roles('admin', 'super_admin')
  async clearKey(@Body() body: { provider: string }) {
    await this.redis.del(`ai:${body.provider}_key`);
    return { cleared: true, provider: body.provider };
  }

  @Get('usage')
  @Roles('admin', 'super_admin')
  async usage() {
    const { prisma } = await import('@eduforge/db');
    const [totalCredits, totalTutor, totalPodcast, totalIllustration] = await Promise.all([
      prisma.aiCreditLedger.aggregate({ where: { reason: 'interactions' }, _sum: { delta: true } }),
      prisma.aiCreditLedger.aggregate({ where: { reason: 'tutor' }, _sum: { delta: true } }),
      prisma.aiCreditLedger.aggregate({ where: { reason: 'tts' }, _sum: { delta: true } }),
      prisma.aiCreditLedger.aggregate({ where: { reason: 'image' }, _sum: { delta: true } }),
    ]);
    return {
      interactions: Math.abs(totalCredits._sum.delta ?? 0),
      tutor: Math.abs(totalTutor._sum.delta ?? 0),
      podcast: Math.abs(totalPodcast._sum.delta ?? 0),
      illustration: Math.abs(totalIllustration._sum.delta ?? 0),
      total: Math.abs((totalCredits._sum.delta ?? 0) + (totalTutor._sum.delta ?? 0) + (totalPodcast._sum.delta ?? 0) + (totalIllustration._sum.delta ?? 0)),
    };
  }
}

function mask(key: string): string {
  if (key.length <= 8) return '***';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
