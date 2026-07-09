import type { Redis } from 'ioredis';
import { AUTH } from '@eduforge/config';
import type { AttemptSnapshot } from '../domain/lockout';
import type { LoginAttemptStore } from '../ports';

/** Bloqueio progressivo com contadores em Redis (janela via TTL). */
export class RedisLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly redis: Redis) {}

  private failKey(key: string): string {
    return `login:fail:${key}`;
  }
  private lockKey(key: string): string {
    return `login:lock:${key}`;
  }

  async get(key: string): Promise<AttemptSnapshot> {
    const [fail, lock] = await this.redis.mget(this.failKey(key), this.lockKey(key));
    return {
      failures: fail ? Number.parseInt(fail, 10) : 0,
      lockedUntil: lock ? Number.parseInt(lock, 10) : null,
    };
  }

  async recordFailure(key: string): Promise<AttemptSnapshot> {
    const failures = await this.redis.incr(this.failKey(key));
    if (failures === 1) {
      await this.redis.expire(this.failKey(key), AUTH.lockout.windowSec);
    }
    const lock = await this.redis.get(this.lockKey(key));
    return { failures, lockedUntil: lock ? Number.parseInt(lock, 10) : null };
  }

  async lock(key: string, untilMs: number): Promise<void> {
    await this.redis.set(this.lockKey(key), String(untilMs), 'EX', AUTH.lockout.lockDurationSec);
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(this.failKey(key), this.lockKey(key));
  }
}
