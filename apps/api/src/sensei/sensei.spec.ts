import { describe, expect, it } from 'vitest';
import { createAiProvider } from '@eduforge/ai';
import { SenseiService } from './sensei.service';
import {
  FakeSenseiProjectRepository,
  FakeSenseiRetrievalRepository,
  FakeSenseiCreditsRepository,
  FakeSenseiEventRepository,
} from './testing/fakes';

function makeAi() {
  return createAiProvider({ provider: 'mock' });
}

async function setup() {
  const ai = makeAi();
  const projects = new FakeSenseiProjectRepository();
  projects.setOwnedProject('p1', 'owner1');
  projects.setOwnedProject('p2', 'owner2'); // owner2 sem saldo
  projects.setEnrollment('enr1', 'learner1', 'p1');
  projects.slugProjectIdMap.set('demo', 'p1');

  const retrieval = new FakeSenseiRetrievalRepository(ai);
  await retrieval.setBlocks('p1', [
    { blockId: 'b1', contentMd: 'A fotossíntese converte luz solar em energia química nos cloroplastos das células vegetais.', sourceRef: { page: 42 } },
    { blockId: 'b2', contentMd: 'A fase clara ocorre na membrana dos tilacoides e produz ATP e NADPH utilizando a energia luminosa.', sourceRef: { page: 43 } },
    { blockId: 'b3', contentMd: 'O ciclo de Calvin ocorre no estroma do cloroplasto e fixa o dióxido de carbono em glicose.', sourceRef: { page: 44 } },
    { blockId: 'b4', contentMd: 'A membrana plasmática controla a entrada e saída de substâncias da célula por transporte ativo e passivo.', sourceRef: { page: 15 } },
  ]);

  const credits = new FakeSenseiCreditsRepository();
  credits.setBalance('owner1', 50);
  credits.setBalance('owner2', 0);
  credits.setBalance('owner3', 50);

  const events = new FakeSenseiEventRepository();

  const service = new SenseiService(projects, retrieval, credits, events, ai);

  return { projects, retrieval, credits, events, ai, service };
}

describe('SenseiService — config', () => {
  it('retorna config default quando nenhuma foi salva', async () => {
    const { service } = await setup();
    const config = await service.getConfig('p1', 'owner1');
    expect(config).toEqual({ name: 'Sensei', avatar: '🤖', tone: 'formal' });
  });

  it('salva e recupera config personalizada', async () => {
    const { service } = await setup();
    await service.setConfig('p1', 'owner1', { name: 'Prof. Bio', avatar: '🧬', tone: 'motivador' });
    const config = await service.getConfig('p1', 'owner1');
    expect(config).toEqual({ name: 'Prof. Bio', avatar: '🧬', tone: 'motivador' });
  });

  it('rejeita getConfig de projeto que não é do usuário (404)', async () => {
    const { service } = await setup();
    await expect(service.getConfig('p1', 'outro')).rejects.toMatchObject({ status: 404 });
  });

  it('rejeita setConfig de projeto que não é do usuário (404)', async () => {
    const { service } = await setup();
    await expect(
      service.setConfig('p1', 'outro', { name: 'X', avatar: '🎓', tone: 'formal' }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('SenseiService — ask (RF-06.1)', () => {
  it('responde com citação válida — pergunta sobre fotossíntese', async () => {
    const { service } = await setup();
    const out = await service.ask('enr1', 'learner1', {
      question: 'Onde acontece a fase clara da fotossíntese?',
      mode: 'default',
    });
    expect(out.refused).toBe(false);
    expect(out.answer.length).toBeGreaterThan(0);
    expect(out.citations.length).toBeGreaterThanOrEqual(1);
    for (const c of out.citations) {
      expect(['b1', 'b2', 'b3', 'b4']).toContain(c.blockId);
      expect(c.sourceRef).toBeDefined();
    }
    expect(out.tutor).toBeDefined();
  });

  it('recusa pergunta fora de escopo — vocabulário sem sobreposição com o conteúdo', async () => {
    const { service } = await setup();
    const out = await service.ask('enr1', 'learner1', {
      question: 'Qual a capital da Mongólia?',
      mode: 'default',
    });
    // O mock embedder usa bag-of-features: "Mongólia" e "capital" não
    // compartilham trigramas com biologia → similaridade < 0.12.
    expect(out.refused).toBe(true);
    expect(out.citations).toHaveLength(0);
  });

  it('grava learning_event tutor_question', async () => {
    const { service, events } = await setup();
    await service.ask('enr1', 'learner1', {
      question: 'O que é fotossíntese?',
      mode: 'default',
    });
    expect(events.events).toHaveLength(1);
    expect(events.events[0].enrollmentId).toBe('enr1');
    const detail = events.events[0].detail as any;
    expect(detail.question).toBe('O que é fotossíntese?');
    expect(typeof detail.refused).toBe('boolean');
  });

  it('NÃO debita crédito quando a resposta é recusada', async () => {
    const { service, credits } = await setup();

    // Resposta recusada (fora de escopo) → NÃO debita.
    await service.ask('enr1', 'learner1', {
      question: 'Capital da Mongólia?',
      mode: 'default',
    });
    expect(credits.debits).toHaveLength(0);
  });

  it('debita crédito quando a resposta não é recusada', async () => {
    const { service, credits } = await setup();

    // Resposta com citação → debita 1 crédito do dono.
    await service.ask('enr1', 'learner1', {
      question: 'O que é fotossíntese?',
      mode: 'default',
    });
    expect(credits.debits).toHaveLength(1);
    expect(credits.debits[0].userId).toBe('owner1');
    expect(credits.debits[0].amount).toBe(1);
  });

  it('retorna 402 quando o dono não tem saldo', async () => {
    const { service, projects, retrieval } = await setup();
    projects.setOwnedProject('p2', 'owner2');
    projects.setEnrollment('enr2', 'learner2', 'p2');
    await retrieval.setBlocks('p2', [
      { blockId: 'bx', contentMd: 'Conteúdo sobre Python e programação funcional.', sourceRef: { page: 1 } },
    ]);

    await expect(
      service.ask('enr2', 'learner2', { question: 'O que é Python?', mode: 'default' }),
    ).rejects.toMatchObject({ status: 402, slug: 'insufficient-credits' });
  });

  it('retorna 409 quando o conteúdo não foi indexado', async () => {
    const { service, projects } = await setup();
    projects.setOwnedProject('p3', 'owner3');
    projects.setEnrollment('enr3', 'learner3', 'p3');
    // p3 não tem blocos → hasEmbeddings = false. owner3 tem saldo 50.

    await expect(
      service.ask('enr3', 'learner3', { question: 'Pergunta?', mode: 'default' }),
    ).rejects.toMatchObject({ status: 409, slug: 'sensei-not-indexed' });
  });

  it('retorna 404 quando a matrícula não é do aprendiz', async () => {
    const { service } = await setup();
    await expect(
      service.ask('enr1', 'outro-learner', { question: 'Pergunta?', mode: 'default' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('usa o tom configurado pelo criador', async () => {
    const { service } = await setup();
    await service.setConfig('p1', 'owner1', { name: 'Mestre', avatar: '🎓', tone: 'motivador' });

    const out = await service.ask('enr1', 'learner1', {
      question: 'O que é fotossíntese?',
      mode: 'default',
    });
    expect(out.tutor.tone).toBe('motivador');
  });
});

describe('SenseiService — getPublicConfig', () => {
  it('retorna config pública + indexed=true quando tem blocos embedados', async () => {
    const { service } = await setup();
    const info = await service.getPublicConfig('demo');
    expect(info).not.toBeNull();
    expect(info!.config).toBeDefined();
    expect(info!.indexed).toBe(true);
  });

  it('retorna 404 para slug não publicado', async () => {
    const { service } = await setup();
    await expect(service.getPublicConfig('slug-inexistente')).rejects.toMatchObject({
      status: 404,
    });
  });
});
