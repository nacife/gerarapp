import { Controller, Get, Post, Param } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

@Controller('admin/webhooks')
export class WebhooksAdminController {
  @Get('stats')
  @Roles('admin', 'super_admin')
  async stats() {
    const [totalEndpoints, totalDeliveries, failedDeliveries, pendingDeliveries] = await Promise.all([
      prisma.webhookEndpoint.count(),
      prisma.webhookDelivery.count(),
      prisma.webhookDelivery.count({ where: { status: 'failed' } }),
      prisma.webhookDelivery.count({ where: { status: 'pending' } }),
    ]);
    return { totalEndpoints, totalDeliveries, failedDeliveries, pendingDeliveries };
  }

  @Get('deliveries')
  @Roles('admin', 'super_admin')
  async listDeliveries() {
    return prisma.webhookDelivery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        endpoint: { select: { id: true, url: true, user: { select: { name: true, email: true } } } },
      },
    });
  }

  @Get('deliveries/failed')
  @Roles('admin', 'super_admin')
  async listFailed() {
    return prisma.webhookDelivery.findMany({
      where: { status: 'failed' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        endpoint: { select: { id: true, url: true, user: { select: { name: true, email: true } } } },
      },
    });
  }

  @Post('deliveries/:id/redeliver')
  @Roles('admin', 'super_admin')
  async redeliver(@Param('id') id: string) {
    const delivery = await prisma.webhookDelivery.findUnique({ where: { id } });
    if (!delivery) return { error: 'not found' };
    // Re-enfileira: seta status para pending para o worker reprocessar
    await prisma.webhookDelivery.update({ where: { id }, data: { status: 'pending', nextRetryAt: new Date() } });
    return { redelivered: true };
  }

  @Get('endpoints')
  @Roles('admin', 'super_admin')
  async listEndpoints() {
    return prisma.webhookEndpoint.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { deliveries: true } },
      },
    });
  }
}
