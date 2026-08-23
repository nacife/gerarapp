import { prisma } from '@eduforge/db';

export interface TimeCapsuleJobData {
  capsuleId: string;
  learnerEmail: string;
  message: string;
  delayMs: number;
}

export async function processTimeCapsule(data: TimeCapsuleJobData): Promise<void> {
  // Simula o envio de e-mail (usando SMTP configurado ou apenas log em dev)
  console.log(`[TimeCapsule] E-mail enviado para ${data.learnerEmail}`);
  console.log(`[TimeCapsule] Mensagem: ${data.message}`);

  // Marca como entregue no banco
  await prisma.timeCapsule.update({
    where: { id: data.capsuleId },
    data: { delivered: true },
  });
}
