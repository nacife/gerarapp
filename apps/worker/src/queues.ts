import { QUEUES } from '@eduforge/config';

/**
 * Filas do pipeline assíncrono (fonte única em @eduforge/config). Processadores
 * reais: ingest (M2), generate (M3), inpi-package (M7), webhook-delivery (M9),
 * tts (M10), account-anonymize (M1 — LGPD).
 */
export const QUEUE_NAMES = Object.values(QUEUES);

export type { QueueName } from '@eduforge/config';
