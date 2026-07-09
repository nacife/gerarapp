import { describe, expect, it } from 'vitest';
import { checkReadiness, type PingableDb } from './health.logic';

const okDb: PingableDb = { $queryRaw: async () => [{ ok: 1 }] };
const failingDb: PingableDb = {
  $queryRaw: async () => {
    throw new Error('connection refused');
  },
};

describe('checkReadiness', () => {
  it('reporta ok quando o banco responde', async () => {
    const report = await checkReadiness(okDb);
    expect(report.status).toBe('ok');
    expect(report.checks.database).toBe('up');
  });

  it('reporta degraded quando o banco falha', async () => {
    const report = await checkReadiness(failingDb);
    expect(report.status).toBe('degraded');
    expect(report.checks.database).toBe('down');
  });
});
