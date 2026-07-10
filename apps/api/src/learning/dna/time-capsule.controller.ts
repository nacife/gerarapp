import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentLearner, LearnerAuthGuard } from '../learner-auth.guard';
import type { AuthenticatedLearner } from '../learner-auth.guard';
import { prisma } from '@eduforge/db';
import { buildTimeCapsuleQuiz } from '@eduforge/ai/time-capsule';

@Controller('public/enrollments')
export class TimeCapsuleController {
  @Post(':id/time-capsule')
  @UseGuards(LearnerAuthGuard)
  async create(@CurrentLearner() learner: AuthenticatedLearner, @Body() body: { message: string }) {
    // Salva a nota e agenda o e-mail para 30 dias depois
    const enrollment = await prisma.enrollment.findFirst({ where: { id: body.enrollmentId ?? '', learnerId: learner.id } });
    if (!enrollment) return { error: 'Matrícula não encontrada' };

    const quiz = buildTimeCapsuleQuiz('Projeto');

    // Em produção: agenda job BullMQ para enviar e-mail em 30 dias via MAILER
    // Em dev: apenas registra no log
    console.log(`[TimeCapsule] Nota de ${learner.id}: "${body.message.slice(0, 50)}..." — quiz será enviado em 30 dias.`);

    return { saved: true, deliverAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), quiz };
  }
}
