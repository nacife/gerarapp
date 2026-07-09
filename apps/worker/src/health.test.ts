import { describe, expect, it } from 'vitest';
import { checkWorkerReadiness } from './health';
import { QUEUE_NAMES } from './queues';

describe('checkWorkerReadiness', () => {
  it('ok quando o Redis responde PONG', async () => {
    const report = await checkWorkerReadiness({ ping: async () => 'PONG' });
    expect(report.status).toBe('ok');
    expect(report.checks.redis).toBe('up');
  });

  it('degraded quando o Redis falha', async () => {
    const report = await checkWorkerReadiness({
      ping: async () => {
        throw new Error('down');
      },
    });
    expect(report.status).toBe('degraded');
    expect(report.checks.redis).toBe('down');
  });
});

describe('QUEUE_NAMES', () => {
  it('inclui as filas do pipeline', () => {
    expect(QUEUE_NAMES).toEqual(
      expect.arrayContaining(['ingest', 'generate', 'tts', 'inpi-package']),
    );
  });
});
