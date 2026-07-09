import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import IORedis, { type Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { SHARED_REDIS } from '../common/redis.module';

@Controller('admin/rate-limit')
export class RateLimitAdminController {
  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  @Get('config')
  @Roles('admin', 'super_admin')
  async getConfig() {
    const [max, windowSec, blocklistSize] = await Promise.all([
      this.redis.get('ratelimit:max').then(v => v ? Number(v) : 60),
      this.redis.get('ratelimit:window').then(v => v ? Number(v) : 60),
      this.redis.llen('ratelimit:blocklist'),
    ]);
    return { maxRequestsPerMinute: max, windowSeconds: windowSec, blocklistSize };
  }

  @Post('config')
  @Roles('admin', 'super_admin')
  async setConfig(@Body() body: { maxRequestsPerMinute?: number; windowSeconds?: number }) {
    if (body.maxRequestsPerMinute) await this.redis.set('ratelimit:max', String(body.maxRequestsPerMinute));
    if (body.windowSeconds) await this.redis.set('ratelimit:window', String(body.windowSeconds));
    const [max, windowSec] = await Promise.all([
      this.redis.get('ratelimit:max').then(v => v ? Number(v) : 60),
      this.redis.get('ratelimit:window').then(v => v ? Number(v) : 60),
    ]);
    return { maxRequestsPerMinute: max, windowSeconds: windowSec };
  }

  @Get('blocklist')
  @Roles('admin', 'super_admin')
  async getBlocklist() {
    const items = await this.redis.lrange('ratelimit:blocklist', 0, -1);
    return { count: items.length, ips: items };
  }

  @Post('blocklist')
  @Roles('admin', 'super_admin')
  async addToBlocklist(@Body() body: { ip: string }) {
    await this.redis.lpush('ratelimit:blocklist', body.ip);
    const items = await this.redis.lrange('ratelimit:blocklist', 0, -1);
    return { count: items.length, added: body.ip };
  }

  @Post('blocklist/clear')
  @Roles('admin', 'super_admin')
  async clearBlocklist() {
    await this.redis.del('ratelimit:blocklist');
    return { cleared: true };
  }
}
