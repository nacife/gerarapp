import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { PrismaSessionRepository } from '../auth/adapters/prisma.repositories';
import { ACCESS_TOKEN_SERVICE } from '../auth/tokens';
import type { AccessTokenService } from '../auth/domain/access-token';
import { PrismaCreditRepository } from '../interactions/adapters/prisma.repositories';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ApiKeysService } from '../api-keys/api-keys.service';

import { AdminUsersController } from './admin-users.controller';
import { FeatureFlagsController } from './feature-flags.controller';
import { AdminApiKeysController } from './admin-api-keys.controller';
import { SystemController } from './system.controller';
import { ApiConfigController } from './api-config.controller';
import { AdminUsersService } from './admin-users.service';
import { FeatureFlagsService } from './feature-flags.service';
import { AdminApiKeysService } from './admin-api-keys.service';
import { SystemService } from './system.service';
import { AuditService } from './audit.service';
import {
  PrismaAdminUserRepository,
  PrismaAuditLogRepository,
  PrismaFeatureFlagRepository,
} from './adapters/prisma.repositories';

@Module({
  imports: [AuthModule, ApiKeysModule],
  controllers: [AdminUsersController, FeatureFlagsController, AdminApiKeysController, SystemController, ApiConfigController],
  providers: [
    { provide: AuditService, useFactory: () => new AuditService(new PrismaAuditLogRepository()) },
    {
      provide: AdminUsersService,
      inject: [AuditService, AuthService, ACCESS_TOKEN_SERVICE],
      useFactory: (audit: AuditService, auth: AuthService, tokens: AccessTokenService) =>
        new AdminUsersService(
          new PrismaAdminUserRepository(),
          new PrismaSessionRepository(),
          new PrismaCreditRepository(),
          audit,
          auth,
          tokens,
        ),
    },
    {
      provide: FeatureFlagsService,
      inject: [AuditService],
      useFactory: (audit: AuditService) => new FeatureFlagsService(new PrismaFeatureFlagRepository(), audit),
    },
    {
      provide: AdminApiKeysService,
      inject: [ApiKeysService, AuditService],
      useFactory: (apiKeys: ApiKeysService, audit: AuditService) => new AdminApiKeysService(apiKeys, audit),
    },
    {
      provide: SystemService,
      inject: [AuditService],
      useFactory: (audit: AuditService) => new SystemService(audit),
    },
  ],
  exports: [FeatureFlagsService, AuditService],
})
export class AdminModule {}
