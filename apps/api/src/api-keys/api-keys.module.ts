import { Module } from '@nestjs/common';
import { getEnv } from '@eduforge/config';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { PrismaApiKeyProjectRepository, PrismaApiKeyRepository } from './adapters/prisma.repositories';

@Module({
  controllers: [ApiKeysController],
  providers: [
    {
      provide: ApiKeysService,
      useFactory: () =>
        new ApiKeysService(
          new PrismaApiKeyRepository(),
          new PrismaApiKeyProjectRepository(),
          getEnv().REFRESH_TOKEN_PEPPER,
        ),
    },
  ],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
