import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { z } from 'zod';
import { prisma } from '@eduforge/db';
import { generateApiKeyValue, hashApiKeyValue } from '../api-keys/domain/key';

const createKeySchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  environment: z.enum(['test', 'live']).default('test'),
  scopes: z.array(z.string()).min(1),
});

type CreateKeyDto = z.infer<typeof createKeySchema>;

@Controller('admin/api-keys')
export class ApiKeysAdminController {
  @Get()
  @Roles('admin', 'super_admin')
  async listAll() {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, prefix: true, name: true, environment: true, scopes: true,
        revokedAt: true, lastUsedAt: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });
    return keys.map((k) => ({
      id: k.id, prefix: k.prefix, name: k.name, environment: k.environment,
      scopes: k.scopes, revoked: !!k.revokedAt,
      lastUsedAt: k.lastUsedAt, createdAt: k.createdAt, user: k.user,
    }));
  }

  @Post()
  @HttpCode(201)
  @Roles('admin', 'super_admin')
  async create(@Body(new ZodValidationPipe(createKeySchema)) dto: CreateKeyDto) {
    const user = await prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!user) return { error: 'Usuário não encontrado' };

    const pepper = process.env.REFRESH_TOKEN_PEPPER ?? 'dev-pepper';
    const { fullKey, keyPrefix } = generateApiKeyValue(dto.environment);
    const key = await prisma.apiKey.create({
      data: {
        userId: dto.userId,
        name: dto.name,
        environment: dto.environment,
        prefix: keyPrefix,
        keyHash: hashApiKeyValue(fullKey, pepper),
        scopes: dto.scopes,
      },
    });

    return {
      id: key.id,
      prefix: key.prefix,
      fullKey,
      name: key.name,
      environment: key.environment,
      scopes: key.scopes,
      created: true,
    };
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  async revoke(@Param('id') id: string) {
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  @Get('stats')
  @Roles('admin', 'super_admin')
  async stats() {
    const [total, active, revoked, uniqueUsers] = await Promise.all([
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { revokedAt: null } }),
      prisma.apiKey.count({ where: { revokedAt: { not: null } } }),
      prisma.apiKey.groupBy({ by: ['userId'], _count: true }),
    ]);
    return { total, active, revoked, uniqueUsers: uniqueUsers.length };
  }

  @Get('scopes')
  @Roles('admin', 'super_admin')
  scopes() {
    return {
      scopes: [
        { key: 'projects:read', desc: 'Ler projetos' },
        { key: 'projects:write', desc: 'Criar/editar projetos' },
        { key: 'content:read', desc: 'Ler conteúdo' },
        { key: 'content:write', desc: 'Criar/editar conteúdo' },
        { key: 'design:read', desc: 'Ler templates/paletas' },
        { key: 'design:write', desc: 'Editar design' },
        { key: 'ai:invoke', desc: 'Invocar geração IA' },
        { key: 'publish', desc: 'Publicar apps' },
        { key: 'analytics:read', desc: 'Ler analytics' },
        { key: 'learners:read', desc: 'Listar aprendizes' },
        { key: 'learners:write', desc: 'Convidar aprendizes' },
        { key: 'inpi:read', desc: 'Ler dados INPI' },
        { key: 'inpi:write', desc: 'Gerar pacote INPI' },
        { key: 'billing:read', desc: 'Ver créditos/faturas' },
        { key: 'jobs:read', desc: 'Status de jobs' },
      ],
    };
  }
}
