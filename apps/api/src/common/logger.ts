import pino from 'pino';
import { getEnv } from '@eduforge/config';

/**
 * Logger estruturado (Pino) — substitui console.log/error.
 * Em produção: JSON (pino-pretty ausente). Em dev: pretty-print colorido.
 * ADR-0072.
 */
export const logger = getEnv().NODE_ENV === 'production'
  ? pino({ level: 'info' })
  : pino({
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    });
