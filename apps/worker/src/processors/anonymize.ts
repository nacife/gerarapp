import { Prisma, prisma } from '@eduforge/db';

/**
 * Anonimização de conta (LGPD, §0.5.7): remove PII mas preserva a linha para
 * integridade referencial. Idempotente. Registra trilha em audit_logs.
 */
export async function anonymizeUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  if (user.email.startsWith('deleted-')) return; // já anonimizado

  const anonEmail = `deleted-${userId}@anonymized.invalid`;

  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        name: 'Usuário removido',
        passwordHash: null,
        mfa: Prisma.DbNull,
        consent: Prisma.DbNull,
        emailVerifiedAt: null,
        status: 'pending_deletion',
      },
    }),
    prisma.auditLog.create({
      data: {
        actorRole: 'system',
        action: 'account.anonymized',
        targetType: 'user',
        targetId: userId,
        beforeAfter: { note: 'PII removida (LGPD)' },
      },
    }),
  ]);
}
