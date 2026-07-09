import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import IORedis, { type Redis } from 'ioredis';
import { AUTH, getEnv } from '@eduforge/config';

import { AuthController } from './auth.controller';
import { MfaController } from './mfa.controller';
import { AccountController } from './account.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { AccountService } from './account.service';
import { ACCESS_TOKEN_SERVICE, AUTH_COOKIE_OPTS, AUTH_REDIS } from './tokens';

import { SystemClock } from './domain/clock';
import { Argon2idHasher } from './domain/password-hasher';
import { OtplibTotpService } from './domain/totp';
import { JwtAccessTokenService } from './domain/access-token';
import { JwtMfaChallengeService } from './domain/challenge-token';
import { LocalBreachedPasswordChecker } from './domain/password-policy';

import {
  PrismaAccountData,
  PrismaAuthTokenRepository,
  PrismaSessionRepository,
  PrismaUserRepository,
} from './adapters/prisma.repositories';
import { RedisLoginAttemptStore } from './adapters/redis.store';
import { ConsoleMailer } from './adapters/console.mailer';
import { BullMqDeletionEnqueuer } from './adapters/enqueuer';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { AdminMfaGuard } from './guards/admin-mfa.guard';
import { RolesGuard } from './guards/roles.guard';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { ApiKeysModule } from '../api-keys/api-keys.module';

@Module({
  imports: [ApiKeysModule],
  controllers: [AuthController, MfaController, AccountController],
  providers: [
    {
      provide: AUTH_REDIS,
      useFactory: (): Redis =>
        new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: false }),
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useFactory: () => new JwtAccessTokenService(getEnv().JWT_SECRET, AUTH.accessTokenTtlSec),
    },
    {
      provide: AUTH_COOKIE_OPTS,
      useFactory: () => ({
        secure: getEnv().NODE_ENV === 'production',
        accessTtlSec: AUTH.accessTokenTtlSec,
        refreshTtlSec: AUTH.refreshTokenTtlSec,
      }),
    },
    {
      provide: AuthService,
      inject: [AUTH_REDIS],
      useFactory: (redis: Redis) => {
        const env = getEnv();
        return new AuthService(
          new PrismaUserRepository(),
          new PrismaSessionRepository(),
          new PrismaAuthTokenRepository(),
          new RedisLoginAttemptStore(redis),
          new ConsoleMailer(),
          new Argon2idHasher(),
          new LocalBreachedPasswordChecker(),
          new OtplibTotpService(),
          new JwtAccessTokenService(env.JWT_SECRET, AUTH.accessTokenTtlSec),
          new JwtMfaChallengeService(env.JWT_SECRET),
          new SystemClock(),
          {
            refreshTokenPepper: env.REFRESH_TOKEN_PEPPER,
            encryptionKey: env.AUTH_ENCRYPTION_KEY,
            refreshTtlSec: AUTH.refreshTokenTtlSec,
            emailVerifyTtlSec: AUTH.emailVerifyTtlSec,
            passwordResetTtlSec: AUTH.passwordResetTtlSec,
            lockDurationSec: AUTH.lockout.lockDurationSec,
            appBaseUrl: env.APP_BASE_URL,
          },
        );
      },
    },
    {
      provide: MfaService,
      useFactory: () =>
        new MfaService(new PrismaUserRepository(), new OtplibTotpService(), getEnv().AUTH_ENCRYPTION_KEY),
    },
    {
      provide: AccountService,
      inject: [AUTH_REDIS],
      useFactory: (redis: Redis) =>
        new AccountService(
          new PrismaUserRepository(),
          new PrismaSessionRepository(),
          new PrismaAccountData(),
          new BullMqDeletionEnqueuer(redis),
          new SystemClock(),
        ),
    },
    // Guards globais (ordem: sessão → API key [preenche req.user se a sessão não preencheu,
    // + rate limit/escopo] → MFA de admin → papéis).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ApiKeyAuthGuard },
    { provide: APP_GUARD, useClass: AdminMfaGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Erros no formato Problem Details (RFC 9457).
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
  exports: [AuthService, ACCESS_TOKEN_SERVICE],
})
export class AuthModule {}
