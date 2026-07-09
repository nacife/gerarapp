import { Prisma, prisma } from '@eduforge/db';
import type { WebhookEventType } from '@eduforge/schemas';
import type { SealedSecret } from '../../auth/domain/crypto';
import type {
  CreateDeliveryInput,
  CreateWebhookEndpointInput,
  DeliveryPatch,
  UpdateWebhookEndpointInput,
  WebhookDeliveryRepository,
  WebhookDeliveryRow,
  WebhookDeliveryStatus,
  WebhookEndpointRepository,
  WebhookEndpointRow,
  WebhookEndpointWithSecret,
  WebhookProjectRepository,
} from '../ports';

function toRow(e: {
  id: string;
  ownerUserId: string;
  projectId: string | null;
  url: string;
  events: string[];
  active: boolean;
  createdAt: Date;
}): WebhookEndpointRow {
  return {
    id: e.id,
    ownerUserId: e.ownerUserId,
    projectId: e.projectId,
    url: e.url,
    events: e.events,
    active: e.active,
    createdAt: e.createdAt,
  };
}

export class PrismaWebhookEndpointRepository implements WebhookEndpointRepository {
  async create(input: CreateWebhookEndpointInput): Promise<WebhookEndpointRow> {
    const created = await prisma.webhookEndpoint.create({
      data: {
        ownerUserId: input.ownerUserId,
        projectId: input.projectId,
        url: input.url,
        events: input.events,
        secretSealed: input.secretSealed as unknown as Prisma.InputJsonValue,
      },
    });
    return toRow(created);
  }

  async findById(id: string): Promise<WebhookEndpointRow | null> {
    const found = await prisma.webhookEndpoint.findUnique({ where: { id } });
    return found ? toRow(found) : null;
  }

  async update(id: string, patch: UpdateWebhookEndpointInput): Promise<WebhookEndpointRow | null> {
    try {
      const updated = await prisma.webhookEndpoint.update({
        where: { id },
        data: { url: patch.url, events: patch.events, active: patch.active },
      });
      return toRow(updated);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    await prisma.webhookEndpoint.deleteMany({ where: { id } });
  }

  async listForOwner(ownerUserId: string): Promise<WebhookEndpointRow[]> {
    const rows = await prisma.webhookEndpoint.findMany({
      where: { ownerUserId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async listActiveForEvent(
    ownerUserId: string,
    projectId: string | null,
    event: WebhookEventType,
  ): Promise<WebhookEndpointWithSecret[]> {
    // Evento de conta (projectId null): só endpoints de conta inteira.
    // Evento de projeto: endpoints de conta inteira + os escopados a esse projeto
    // (Prisma rejeita `in: [null, valor]` para colunas anuláveis — precisa de OR explícito).
    const rows = await prisma.webhookEndpoint.findMany({
      where: {
        ownerUserId,
        active: true,
        events: { has: event },
        OR: projectId === null ? [{ projectId: null }] : [{ projectId: null }, { projectId }],
      },
    });
    return rows.map((r) => ({ ...toRow(r), secretSealed: r.secretSealed as unknown as SealedSecret }));
  }
}

function toDeliveryRow(d: {
  id: string;
  endpointId: string;
  eventType: string;
  payload: unknown;
  status: string;
  attempts: number;
  responseStatus: number | null;
  responseBody: string | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
}): WebhookDeliveryRow {
  return {
    id: d.id,
    endpointId: d.endpointId,
    eventType: d.eventType,
    payload: d.payload,
    status: d.status as WebhookDeliveryStatus,
    attempts: d.attempts,
    responseStatus: d.responseStatus,
    responseBody: d.responseBody,
    lastAttemptAt: d.lastAttemptAt,
    createdAt: d.createdAt,
  };
}

export class PrismaWebhookDeliveryRepository implements WebhookDeliveryRepository {
  async create(input: CreateDeliveryInput): Promise<WebhookDeliveryRow> {
    const created = await prisma.webhookDelivery.create({
      data: {
        endpointId: input.endpointId,
        eventType: input.eventType,
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
    return toDeliveryRow(created);
  }

  async findById(id: string): Promise<WebhookDeliveryRow | null> {
    const found = await prisma.webhookDelivery.findUnique({ where: { id } });
    return found ? toDeliveryRow(found) : null;
  }

  async update(id: string, patch: DeliveryPatch): Promise<WebhookDeliveryRow> {
    const updated = await prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: patch.status,
        attempts: patch.attempts,
        responseStatus: patch.responseStatus,
        responseBody: patch.responseBody,
        lastAttemptAt: patch.lastAttemptAt,
      },
    });
    return toDeliveryRow(updated);
  }

  async listForEndpoint(endpointId: string, limit = 50): Promise<WebhookDeliveryRow[]> {
    const rows = await prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toDeliveryRow);
  }
}

export class PrismaWebhookProjectRepository implements WebhookProjectRepository {
  async findByIdForOwner(id: string, ownerUserId: string): Promise<{ id: string } | null> {
    return prisma.project.findFirst({ where: { id, ownerUserId }, select: { id: true } });
  }

  async findOwnerId(projectId: string): Promise<string | null> {
    const found = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerUserId: true } });
    return found?.ownerUserId ?? null;
  }
}
