import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ApiKeysService } from './api-keys.service';
import { API_KEY_SCOPES } from './domain/scopes';
import { createApiKeySchema, type CreateApiKeyDto } from './dto/schemas';
import type { ApiKeyRow } from './ports';

function toView(key: ApiKeyRow) {
  return {
    id: key.id,
    name: key.name,
    environment: key.environment,
    projectId: key.projectId,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  };
}

/** Gestão de chaves da API pública pelo criador (Parte 6.B.1). */
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Get('scopes')
  scopes() {
    return { scopes: API_KEY_SCOPES };
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return (await this.apiKeys.list(user.id)).map(toView);
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createApiKeySchema)) dto: CreateApiKeyDto,
  ) {
    const { key, fullKey } = await this.apiKeys.create(user.id, dto);
    return { ...toView(key), key: fullKey };
  }

  @Delete(':id')
  @HttpCode(200)
  async revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return toView(await this.apiKeys.revoke(user.id, id));
  }
}
