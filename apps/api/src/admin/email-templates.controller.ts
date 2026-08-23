import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { prisma } from '@eduforge/db';

const TEMPLATE_KEYS = ['welcome', 'verify-email', 'password-reset', 'certificate', 'invite'];

@Controller('admin/email-templates')
export class EmailTemplatesController {
  @Get()
  @Roles('admin', 'super_admin')
  async list() {
    const records = await prisma.emailTemplate.findMany();
    const map = new Map(records.map((r) => [r.key, r]));

    const templates: Record<string, { subject: string; body: string }> = {};
    for (const key of TEMPLATE_KEYS) {
      const dbVal = map.get(key);
      const def = getDefault(key);
      templates[key] = {
        subject: dbVal?.subject ?? def.subject,
        body: dbVal?.bodyHtml ?? def.body,
      };
    }
    return templates;
  }

  @Post()
  @Roles('admin', 'super_admin')
  async save(@Body() body: { key: string; subject: string; body: string }) {
    await prisma.emailTemplate.upsert({
      where: { key: body.key },
      create: { key: body.key, subject: body.subject, bodyHtml: body.body },
      update: { subject: body.subject, bodyHtml: body.body },
    });
    return { saved: true };
  }
}

function getDefault(key: string): { subject: string; body: string } {
  const defaults: Record<string, { subject: string; body: string }> = {
    welcome: {
      subject: 'Bem-vindo(a) ao EduForge!',
      body: 'Olá {{name}}, sua conta foi criada com sucesso.',
    },
    'verify-email': {
      subject: 'Confirme seu e-mail — EduForge',
      body: 'Olá {{name}}, clique no link para verificar seu e-mail: {{link}}',
    },
    'password-reset': {
      subject: 'Redefinição de senha — EduForge',
      body: 'Olá {{name}}, use este link para redefinir sua senha: {{link}}',
    },
    certificate: {
      subject: 'Certificado de conclusão — EduForge',
      body: 'Parabéns {{name}}! Você concluiu {{projectTitle}}. Seu certificado: {{link}}',
    },
    invite: {
      subject: 'Convite para {{projectTitle}} — EduForge',
      body: 'Olá! Você foi convidado(a) para acessar {{projectTitle}}. Acesse: {{link}}',
    },
  };
  return defaults[key] ?? { subject: '', body: '' };
}
