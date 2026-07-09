import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import { getEnv, loadRootEnv } from '@eduforge/config';
import { AppModule } from './app.module';

async function bootstrap() {
  loadRootEnv();
  const env = getEnv();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie);

  // API pública sob /v1 (Parte 6.B); healthchecks ficam na raiz.
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });

  // Em produção, allowlist estrita; em dev, qualquer localhost:<porta>.
  const allowlist = [env.APP_BASE_URL, env.ADMIN_BASE_URL, env.RUNTIME_BASE_URL];
  const isDevLocalhost = (origin: string) => /^https?:\/\/localhost:\d+$/.test(origin);
  app.enableCors({
    origin:
      env.NODE_ENV === 'production'
        ? allowlist
        : (origin, cb) => cb(null, !origin || isDevLocalhost(origin) || allowlist.includes(origin)),
    credentials: true,
  });

  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
  // eslint-disable-next-line no-console
  console.log(`🚀 API EduForge em http://localhost:${env.API_PORT} — health em /health`);
}

void bootstrap();
