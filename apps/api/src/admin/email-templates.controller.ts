import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import IORedis, { type Redis } from 'ioredis';
import { Inject } from '@nestjs/common';
import { SHARED_REDIS } from '../common/redis.module';

const TEMPLATE_KEYS = ['welcome', 'verify-email', 'password-reset', 'certificate', 'invite'];

@Controller('admin/email-templates')
export class EmailTemplatesController {
  constructor(@Inject(SHARED_REDIS) private readonly redis: Redis) {}

  @Get()
  @Roles('admin', 'super_admin')
  async list() {
    const templates: Record<string, { subject: string; body: string }> = {};
    for (const key of TEMPLATE_KEYS) {
      const subject = await this.redis.get(`email:${key}:subject`) ?? getDefault(key).subject;
      const body = await this.redis.get(`email:${key}:body`) ?? getDefault(key).body;
      templates[key] = { subject, body };
    }
    return templates;
  }

  @Post()
  @Roles('admin', 'super_admin')
  async save(@Body() body: { key: string; subject: string; body: string }) {
    await this.redis.set(`email:${body.key}:subject`, body.subject);
    await this.redis.set(`email:${body.key}:body`, body.body);
    return { saved: true };
  }
}

function getDefault(key: string): { subject: string; body: string } {
  const defaults: Record<string, { subject: string; body: string }> = {
    welcome: { subject: 'Bem-vindo(a) ao EduForge!', body: 'Olá {{name}}, sua conta foi criada com sucesso.' },
    'verify-email': { subject: 'Confirme seu e-mail — EduForge', body: 'Olá {{name}}, clique no link para verificar seu e-mail: {{link}}' },
    'password-reset': { subject: 'Redefinição de senha — EduForge', body: 'Olá {{name}}, use este link para redefinir sua senha: {{link}}' },
    certificate: { subject: 'Certificado de conclusão — EduForge', body: 'Parabéns {{name}}! Você concluiu {{projectTitle}}. Seu certificado: {{link}}' },
    invite: { subject: 'Convite para {{projectTitle}} — EduForge', body: 'Olá! Você foi convidado(a) para acessar {{projectTitle}}. Acesse: {{link}}' },
  };
  return defaults[key] ?? { subject: '', body: '' };
}
