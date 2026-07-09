import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { WEBHOOK_EVENT_TYPES } from '@eduforge/schemas';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { WebhooksService } from './webhooks.service';
import {
  createWebhookSchema,
  updateWebhookSchema,
  type CreateWebhookDto,
  type UpdateWebhookDto,
} from './dto/schemas';
import type { WebhookDeliveryRow, WebhookEndpointRow } from './ports';

function endpointView(e: WebhookEndpointRow) {
  return {
    id: e.id,
    url: e.url,
    events: e.events,
    projectId: e.projectId,
    active: e.active,
    createdAt: e.createdAt,
  };
}

function deliveryView(d: WebhookDeliveryRow) {
  return {
    id: d.id,
    eventType: d.eventType,
    status: d.status,
    attempts: d.attempts,
    responseStatus: d.responseStatus,
    lastAttemptAt: d.lastAttemptAt,
    createdAt: d.createdAt,
  };
}

/** CRUD de webhooks do criador + histórico e reentrega manual de entregas (Parte 6.B.4). */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Get('events')
  events() {
    return { events: WEBHOOK_EVENT_TYPES };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWebhookSchema)) dto: CreateWebhookDto,
  ) {
    return endpointView(await this.webhooks.create(user.id, dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return (await this.webhooks.list(user.id)).map(endpointView);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateWebhookSchema)) dto: UpdateWebhookDto,
  ) {
    return endpointView(await this.webhooks.update(user.id, id, dto));
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.webhooks.remove(user.id, id);
    return { deleted: true };
  }

  @Get(':id/deliveries')
  async deliveries(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return (await this.webhooks.listDeliveries(user.id, id)).map(deliveryView);
  }

  @Post('deliveries/:deliveryId/redeliver')
  @HttpCode(202)
  async redeliver(@CurrentUser() user: AuthenticatedUser, @Param('deliveryId') deliveryId: string) {
    return deliveryView(await this.webhooks.redeliver(user.id, deliveryId));
  }
}
