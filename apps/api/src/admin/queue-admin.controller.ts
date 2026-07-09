import { Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import IORedis from 'ioredis';
import { getEnv } from '@eduforge/config';

@Controller('admin/queues')
export class QueueAdminController {
  private getRedis() {
    return new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2000 });
  }

  @Get()
  @Roles('admin', 'super_admin')
  async list() {
    const redis = this.getRedis();
    const queues = ['ingest', 'generate', 'tts', 'inpi-package', 'sensei-embed', 'webhook-delivery'];
    const result: Record<string, unknown> = {};

    for (const q of queues) {
      const [waiting, active, failed, completed, delayed] = await Promise.all([
        redis.llen(`bull:${q}:wait`),
        redis.llen(`bull:${q}:active`),
        redis.llen(`bull:${q}:failed`),
        redis.llen(`bull:${q}:completed`),
        redis.llen(`bull:${q}:delayed`),
      ]);
      result[q] = { waiting, active, failed, completed, delayed };
    }
    redis.disconnect();
    return result;
  }

  @Get(':name/failed')
  @Roles('admin', 'super_admin')
  async listFailed(@Param('name') name: string) {
    const redis = this.getRedis();
    const jobs: unknown[] = [];
    const count = await redis.llen(`bull:${name}:failed`);
    const items = await redis.lrange(`bull:${name}:failed`, 0, 49);
    for (const item of items) {
      try { jobs.push(JSON.parse(item)); } catch { jobs.push({ raw: item }); }
    }
    redis.disconnect();
    return { queue: name, totalFailed: count, jobs };
  }

  @Post(':name/retry-all')
  @Roles('admin', 'super_admin')
  async retryAll(@Param('name') name: string) {
    const redis = this.getRedis();
    let count = 0;
    const items = await redis.lrange(`bull:${name}:failed`, 0, -1);
    for (const item of items) {
      try {
        const job = JSON.parse(item);
        await redis.lpush(`bull:${name}:wait`, item);
        count++;
        // Job data is serialized; BullMQ will pick it up
      } catch { /* skip */ }
    }
    await redis.del(`bull:${name}:failed`);
    redis.disconnect();
    return { queue: name, retried: count };
  }

  @Post(':name/clean')
  @Roles('admin', 'super_admin')
  async cleanCompleted(@Param('name') name: string) {
    const redis = this.getRedis();
    await redis.del(`bull:${name}:completed`);
    redis.disconnect();
    return { queue: name, cleaned: true };
  }
}
