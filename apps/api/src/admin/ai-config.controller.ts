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
    const [anthropicKey, openaiKey, deepseekKey, fallbackOrderRaw, mockFallbackRaw, anthropicModel, openaiModel, deepseekModel] = await Promise.all([
      this.redis.get('ai:anthropic_key'),
      this.redis.get('ai:openai_key'),
      this.redis.get('ai:deepseek_key'),
      this.redis.get('ai:fallback_order'),
      this.redis.get('ai:mock_fallback'),
      this.redis.get('ai:anthropic_model'),
      this.redis.get('ai:openai_model'),
      this.redis.get('ai:deepseek_model'),
    ]);

    const fallbackOrder: string[] = fallbackOrderRaw ? JSON.parse(fallbackOrderRaw) : ['anthropic', 'deepseek', 'openai'];

    return {
      provider: env.AI_PROVIDER,
      providers: {
        anthropic: {
          model: anthropicModel ?? env.AI_MODEL_STRUCTURE ?? 'claude-sonnet-4-6',
          hasKey: !!(anthropicKey || env.ANTHROPIC_API_KEY),
          keyPreview: anthropicKey ? mask(anthropicKey) : (env.ANTHROPIC_API_KEY ? mask(env.ANTHROPIC_API_KEY) : null),
          keySource: anthropicKey ? 'redis' : env.ANTHROPIC_API_KEY ? 'env' : 'none',
        },
        openai: {
          model: openaiModel ?? 'gpt-4o',
          hasKey: !!openaiKey,
          keyPreview: openaiKey ? mask(openaiKey) : null,
          keySource: openaiKey ? 'redis' : 'none',
        },
        deepseek: {
          model: deepseekModel ?? 'deepseek-chat',
          hasKey: !!deepseekKey,
          keyPreview: deepseekKey ? mask(deepseekKey) : null,
          keySource: deepseekKey ? 'redis' : 'none',
        },
      },
      fallbackOrder,
      mockFallback: mockFallbackRaw !== 'false',
      note: 'As chaves no Redis têm precedência sobre .env.',
    };
  }

  @Post('provider')
  @Roles('admin', 'super_admin')
  async saveProvider(@Body() body: { provider: string; apiKey: string; model?: string }) {
    if (!body.apiKey || !body.provider) return { error: 'provider e apiKey são obrigatórios' };
    await this.redis.set(`ai:${body.provider}_key`, body.apiKey);
    if (body.model) await this.redis.set(`ai:${body.provider}_model`, body.model);
    return { saved: true, provider: body.provider };
  }

  @Post('provider/clear')
  @Roles('admin', 'super_admin')
  async clearProvider(@Body() body: { provider: string }) {
    await this.redis.del(`ai:${body.provider}_key`);
    return { cleared: true, provider: body.provider };
  }

  @Post('fallback')
  @Roles('admin', 'super_admin')
  async saveFallback(@Body() body: { order: string[]; mockFallback: boolean }) {
    await this.redis.set('ai:fallback_order', JSON.stringify(body.order));
    await this.redis.set('ai:mock_fallback', body.mockFallback ? 'true' : 'false');
    return { saved: true, order: body.order, mockFallback: body.mockFallback };
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
