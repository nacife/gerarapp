import { prisma } from '@eduforge/db';
import type { SealedSecret } from '@eduforge/schemas/crypto';
import type { RecordAttemptInput, WebhookEndpointForDelivery } from './pipeline';

export class PrismaWebhookDeliveryRepository {
  async getEndpoint(endpointId: string): Promise<WebhookEndpointForDelivery | null> {
    const found = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
      select: { url: true, active: true, secretSealed: true },
    });
    if (!found) return null;
    return { url: found.url, active: found.active, secretSealed: found.secretSealed as unknown as SealedSecret };
  }

  async recordAttempt(deliveryId: string, patch: RecordAttemptInput): Promise<void> {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: patch.status,
        attempts: patch.attempts,
        responseStatus: patch.responseStatus,
        responseBody: patch.responseBody,
        lastAttemptAt: patch.lastAttemptAt,
      },
    });
  }
}
