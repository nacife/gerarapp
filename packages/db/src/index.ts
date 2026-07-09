import { PrismaClient } from '@prisma/client';

/**
 * Singleton do Prisma Client. Em dev, guardamos no globalThis para não abrir
 * múltiplas conexões a cada hot-reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-exporta tipos, enums e o namespace Prisma para consumo pelos apps.
export * from '@prisma/client';
