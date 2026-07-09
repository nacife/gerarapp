import { randomUUID } from 'node:crypto';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from './errors';

const ERROR_BASE = 'https://docs.eduforge.app/errors';

/** Converte exceções em Problem Details (RFC 9457 / Parte 6.B.5). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const traceId = `req_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    let status = 500;
    let body: Record<string, unknown>;

    if (exception instanceof AppError) {
      status = exception.status;
      body = {
        type: `${ERROR_BASE}/${exception.slug}`,
        title: exception.title,
        status,
        detail: exception.detail,
        ...exception.extra,
        trace_id: traceId,
      };
    } else if (exception instanceof ZodError) {
      status = 400;
      body = {
        type: `${ERROR_BASE}/validation`,
        title: 'Erro de validação',
        status,
        detail: 'Um ou mais campos são inválidos.',
        errors: exception.issues.map((i) => ({
          pointer: `/${i.path.join('/')}`,
          message: i.message,
        })),
        trace_id: traceId,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      body = {
        type: `${ERROR_BASE}/http`,
        title: typeof resp === 'string' ? resp : ((resp as { message?: string }).message ?? 'Erro'),
        status,
        trace_id: traceId,
      };
    } else {
      body = { type: 'about:blank', title: 'Erro interno do servidor', status: 500, trace_id: traceId };
      // eslint-disable-next-line no-console
      console.error(`[${traceId}]`, exception);
    }

    void reply.status(status).header('content-type', 'application/problem+json').send(body);
  }
}
