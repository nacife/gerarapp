import { describe, expect, it } from 'vitest';
import { encryptSecret } from '@eduforge/schemas';
import { runWebhookDelivery, type RecordAttemptInput, type WebhookDeliveryPorts, type WebhookEndpointForDelivery, type HttpResponse } from './pipeline';

const ENCRYPTION_KEY = 'a-32-char-or-longer-test-secret!';
const SEALED = encryptSecret('whsec_test', ENCRYPTION_KEY);

class FakePorts implements WebhookDeliveryPorts {
  encryptionKey = ENCRYPTION_KEY;
  endpoint: WebhookEndpointForDelivery | null = { url: 'https://example.com/hook', active: true, secretSealed: SEALED };
  attempts: RecordAttemptInput[] = [];
  postResult: HttpResponse | Error = { status: 200, body: 'ok' };
  postCalls: { url: string; body: string; headers: Record<string, string> }[] = [];

  async getEndpoint(): Promise<WebhookEndpointForDelivery | null> {
    return this.endpoint;
  }

  async recordAttempt(_deliveryId: string, patch: RecordAttemptInput): Promise<void> {
    this.attempts.push(patch);
  }

  async post(url: string, body: string, headers: Record<string, string>): Promise<HttpResponse> {
    this.postCalls.push({ url, body, headers });
    if (this.postResult instanceof Error) throw this.postResult;
    return this.postResult;
  }
}

const JOB_DATA = { deliveryId: 'd1', endpointId: 'e1', eventType: 'app.published', payload: { version: 1 } };

describe('runWebhookDelivery', () => {
  it('assina o corpo e envia os headers corretos', async () => {
    const ports = new FakePorts();
    await runWebhookDelivery(JOB_DATA, 0, false, ports);

    expect(ports.postCalls).toHaveLength(1);
    const call = ports.postCalls[0]!;
    expect(call.url).toBe('https://example.com/hook');
    expect(call.headers['x-eduforge-event']).toBe('app.published');
    expect(call.headers['x-eduforge-signature']).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(JSON.parse(call.body)).toEqual({ version: 1 });
  });

  it('registra sucesso quando o endpoint responde 2xx', async () => {
    const ports = new FakePorts();
    await runWebhookDelivery(JOB_DATA, 0, false, ports);
    expect(ports.attempts).toEqual([
      { status: 'success', attempts: 1, responseStatus: 200, responseBody: 'ok', lastAttemptAt: expect.any(Date) },
    ]);
  });

  it('registra failed (não exhausted) numa resposta não-2xx quando ainda há tentativas', async () => {
    const ports = new FakePorts();
    ports.postResult = { status: 500, body: 'internal error' };
    await expect(runWebhookDelivery(JOB_DATA, 2, false, ports)).rejects.toThrow();
    expect(ports.attempts[0]).toMatchObject({ status: 'failed', attempts: 3, responseStatus: 500 });
  });

  it('marca exhausted na última tentativa permitida', async () => {
    const ports = new FakePorts();
    ports.postResult = { status: 503, body: 'unavailable' };
    await expect(runWebhookDelivery(JOB_DATA, 12, true, ports)).rejects.toThrow();
    expect(ports.attempts[0]).toMatchObject({ status: 'exhausted', attempts: 13, responseStatus: 503 });
  });

  it('erro de rede (sem resposta) ainda registra a tentativa como failed', async () => {
    const ports = new FakePorts();
    ports.postResult = new Error('ECONNREFUSED');
    await expect(runWebhookDelivery(JOB_DATA, 0, false, ports)).rejects.toThrow();
    expect(ports.attempts[0]).toMatchObject({ status: 'failed', responseStatus: null, responseBody: 'ECONNREFUSED' });
  });

  it('endpoint removido/inativo marca exhausted sem tentar entregar', async () => {
    const ports = new FakePorts();
    ports.endpoint = null;
    await runWebhookDelivery(JOB_DATA, 0, false, ports);
    expect(ports.postCalls).toHaveLength(0);
    expect(ports.attempts[0]).toMatchObject({ status: 'exhausted' });
  });

  it('endpoint desativado marca exhausted sem tentar entregar', async () => {
    const ports = new FakePorts();
    ports.endpoint = { url: 'https://x.com', active: false, secretSealed: SEALED };
    await runWebhookDelivery(JOB_DATA, 0, false, ports);
    expect(ports.postCalls).toHaveLength(0);
    expect(ports.attempts[0]).toMatchObject({ status: 'exhausted' });
  });

  it('endpoint inativo não relança (não deve reter — sem sentido reter para sempre)', async () => {
    const ports = new FakePorts();
    ports.endpoint = null;
    await expect(runWebhookDelivery(JOB_DATA, 0, false, ports)).resolves.toBeUndefined();
  });

  it('trunca corpos de resposta muito grandes', async () => {
    const ports = new FakePorts();
    ports.postResult = { status: 200, body: 'x'.repeat(5000) };
    await runWebhookDelivery(JOB_DATA, 0, false, ports);
    expect(ports.attempts[0]!.responseBody!.length).toBe(2000);
  });
});
