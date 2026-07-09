import { describe, expect, it } from 'vitest';
import { WebhooksService } from './webhooks.service';
import {
  InMemoryWebhookDeliveryRepository,
  InMemoryWebhookEndpointRepository,
  InMemoryWebhookEnqueuer,
  InMemoryWebhookProjectRepository,
} from './testing/fakes';

const OWNER = 'owner-1';
const OTHER_OWNER = 'owner-2';
const ENCRYPTION_KEY = 'a-32-char-or-longer-test-secret!';

function buildService() {
  const endpoints = new InMemoryWebhookEndpointRepository();
  const deliveries = new InMemoryWebhookDeliveryRepository();
  const projects = new InMemoryWebhookProjectRepository();
  const enqueuer = new InMemoryWebhookEnqueuer();
  const service = new WebhooksService(endpoints, deliveries, projects, enqueuer, ENCRYPTION_KEY);
  return { endpoints, deliveries, projects, enqueuer, service };
}

describe('WebhooksService.create', () => {
  it('cria o endpoint e nunca expõe o segredo em claro no retorno', async () => {
    const { service } = buildService();
    const created = await service.create(OWNER, {
      url: 'https://example.com/hook',
      events: ['app.published'],
      secret: 'super-secret-value',
    });
    expect(created.url).toBe('https://example.com/hook');
    expect((created as unknown as { secret?: string }).secret).toBeUndefined();
    expect((created as unknown as { secretSealed?: unknown }).secretSealed).toBeUndefined();
  });

  it('rejeita projeto que não pertence ao dono', async () => {
    const { service, projects } = buildService();
    projects.ownedProjectIds.set('proj-1', OTHER_OWNER);
    await expect(
      service.create(OWNER, { url: 'https://x.com', events: ['app.published'], secret: '0123456789abcdef', projectId: 'proj-1' }),
    ).rejects.toThrow();
  });
});

describe('WebhooksService.dispatch', () => {
  it('não faz nada quando nenhum endpoint está inscrito no evento', async () => {
    const { service, deliveries, enqueuer } = buildService();
    await service.dispatch(OWNER, null, 'app.published', { foo: 'bar' });
    expect(deliveries.rows).toHaveLength(0);
    expect(enqueuer.calls).toHaveLength(0);
  });

  it('cria entrega + enfileira para endpoint de conta inteira', async () => {
    const { service, deliveries, enqueuer } = buildService();
    await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });

    await service.dispatch(OWNER, 'proj-1', 'app.published', { version: 2 });

    expect(deliveries.rows).toHaveLength(1);
    expect(deliveries.rows[0]?.eventType).toBe('app.published');
    expect(enqueuer.calls).toHaveLength(1);
  });

  it('endpoint escopado a outro projeto não recebe o evento', async () => {
    const { service, deliveries, projects } = buildService();
    projects.ownedProjectIds.set('proj-A', OWNER);
    projects.ownedProjectIds.set('proj-B', OWNER);
    await service.create(OWNER, {
      url: 'https://a.com',
      events: ['app.published'],
      secret: '0123456789abcdef',
      projectId: 'proj-A',
    });

    await service.dispatch(OWNER, 'proj-B', 'app.published', {});
    expect(deliveries.rows).toHaveLength(0);
  });

  it('evento de conta (projectId null) só alcança endpoints de conta inteira', async () => {
    const { service, deliveries, projects } = buildService();
    projects.ownedProjectIds.set('proj-A', OWNER);
    await service.create(OWNER, {
      url: 'https://scoped.com',
      events: ['credits.low_balance'],
      secret: '0123456789abcdef',
      projectId: 'proj-A',
    });
    await service.create(OWNER, {
      url: 'https://acct.com',
      events: ['credits.low_balance'],
      secret: '0123456789abcdef',
    });

    await service.dispatch(OWNER, null, 'credits.low_balance', {});
    expect(deliveries.rows).toHaveLength(1);
  });

  it('endpoint inativo não recebe entregas', async () => {
    const { service, endpoints, deliveries } = buildService();
    const created = await service.create(OWNER, {
      url: 'https://a.com',
      events: ['app.published'],
      secret: '0123456789abcdef',
    });
    await endpoints.update(created.id, { active: false });

    await service.dispatch(OWNER, null, 'app.published', {});
    expect(deliveries.rows).toHaveLength(0);
  });

  it('endpoint sem o evento na lista não recebe entrega', async () => {
    const { service, deliveries } = buildService();
    await service.create(OWNER, { url: 'https://a.com', events: ['ingest.completed'], secret: '0123456789abcdef' });

    await service.dispatch(OWNER, null, 'app.published', {});
    expect(deliveries.rows).toHaveLength(0);
  });

  it('o payload enfileirado usa o envelope padrão { id, event, occurred_at, data }', async () => {
    const { service, enqueuer } = buildService();
    await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });

    await service.dispatch(OWNER, null, 'app.published', { versionNumber: 3 });

    const sent = enqueuer.calls[0]?.payload as { id: string; event: string; occurred_at: string; data: unknown };
    expect(sent.id.startsWith('evt_')).toBe(true);
    expect(sent.event).toBe('app.published');
    expect(sent.data).toEqual({ versionNumber: 3 });
  });

  it('nunca lança mesmo se o repositório falhar (best-effort)', async () => {
    const { service, endpoints } = buildService();
    await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    endpoints.listActiveForEvent = async () => {
      throw new Error('db indisponível');
    };

    await expect(service.dispatch(OWNER, null, 'app.published', {})).resolves.toBeUndefined();
  });
});

describe('WebhooksService.dispatchForProject', () => {
  it('resolve o dono a partir do projeto e despacha', async () => {
    const { service, projects, deliveries } = buildService();
    projects.ownedProjectIds.set('proj-1', OWNER);
    await service.create(OWNER, { url: 'https://a.com', events: ['learner.enrolled'], secret: '0123456789abcdef' });

    await service.dispatchForProject('proj-1', 'learner.enrolled', { learnerId: 'l1' });

    expect(deliveries.rows).toHaveLength(1);
  });

  it('projeto desconhecido não lança, apenas não despacha', async () => {
    const { service, deliveries } = buildService();
    await expect(service.dispatchForProject('proj-inexistente', 'learner.enrolled', {})).resolves.toBeUndefined();
    expect(deliveries.rows).toHaveLength(0);
  });
});

describe('WebhooksService.update/remove', () => {
  it('dono consegue desativar o próprio endpoint', async () => {
    const { service } = buildService();
    const created = await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    const updated = await service.update(OWNER, created.id, { active: false });
    expect(updated.active).toBe(false);
  });

  it('não deixa atualizar endpoint de outro dono', async () => {
    const { service } = buildService();
    const created = await service.create(OTHER_OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    await expect(service.update(OWNER, created.id, { active: false })).rejects.toThrow();
  });

  it('remove o endpoint do dono', async () => {
    const { service, endpoints } = buildService();
    const created = await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    await service.remove(OWNER, created.id);
    expect(await endpoints.findById(created.id)).toBeNull();
  });
});

describe('WebhooksService.redeliver', () => {
  it('reenfileira o mesmo payload como uma nova entrega', async () => {
    const { service, enqueuer, deliveries } = buildService();
    await service.create(OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    await service.dispatch(OWNER, null, 'app.published', { versionNumber: 1 });
    const original = deliveries.rows[0]!;

    const retry = await service.redeliver(OWNER, original.id);

    expect(retry.id).not.toBe(original.id);
    expect(retry.payload).toEqual(original.payload);
    expect(enqueuer.calls).toHaveLength(2);
  });

  it('não deixa reentregar payload de endpoint de outro dono', async () => {
    const { service, deliveries } = buildService();
    await service.create(OTHER_OWNER, { url: 'https://a.com', events: ['app.published'], secret: '0123456789abcdef' });
    await service.dispatch(OTHER_OWNER, null, 'app.published', {});
    const original = deliveries.rows[0]!;

    await expect(service.redeliver(OWNER, original.id)).rejects.toThrow();
  });
});
