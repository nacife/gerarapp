import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { SHARED_REDIS } from './redis.module';

/**
 * Cache compartilhado via Redis para dados estáticos/quentes:
 * templates, paletas, leaderboards, contagens.
 * TTL padrão: 5 minutos.
 */
@Injectable()
export class CacheService {
  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(`cache:${key}`);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await this.redis.set(`cache:${key}`, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.redis.del(`cache:${key}`);
  }

  /** Executa a fn se não houver cache, armazena e retorna. */
  async wrap<T>(key: string, fn: () => Promise<T>, ttlSeconds = 300): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const result = await fn();
    await this.set(key, result, ttlSeconds);
    return result;
  }
}
