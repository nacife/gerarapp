import { Global, Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';

export const SHARED_REDIS = Symbol('SHARED_REDIS');

/**
 * Módulo global: uma ÚNICA conexão Redis compartilhada por todos os módulos.
 * Substitui as 7 conexões separadas que existiam antes (ADR-0070).
 */
@Global()
@Module({
  providers: [
    {
      provide: SHARED_REDIS,
      useFactory: (): Redis =>
        new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null, enableOfflineQueue: true }),
    },
  ],
  exports: [SHARED_REDIS],
})
export class SharedRedisModule {}
