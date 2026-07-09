import type { InteractionType } from './envelope';

const MEDIA_UUID = '22222222-2222-2222-2222-222222222222';

function envelope(type: InteractionType, contentBlockId: string) {
  return {
    schema_version: 1 as const,
    type,
    source_ref: { content_block_id: contentBlockId },
    difficulty: 'medium' as const,
    objective: 'Compreender o conteúdo desta seção.',
    xp: 10,
  };
}

/**
 * Constrói um payload de interação VÁLIDO (schema + regras semânticas) do tipo
 * pedido. Usado pelo MockAiProvider e pelos testes. `seed` varia o conteúdo
 * sem invalidar o payload.
 */
export function buildValidInteraction(
  type: InteractionType,
  contentBlockId: string,
  seed = 0,
): Record<string, unknown> {
  const env = envelope(type, contentBlockId);
  const s = String(seed % 100);

  switch (type) {
    case 'quiz':
      return {
        ...env,
        question_md: `Qual é a ideia central da seção ${s}?`,
        mode: 'single',
        options: [
          { id: 'opt_aaa111', text_md: `Alternativa correta ${s}`, correct: true },
          { id: 'opt_bbb222', text_md: `Distrator um ${s}`, correct: false },
          { id: 'opt_ccc333', text_md: `Distrator dois ${s}`, correct: false },
        ],
        feedback: {
          correct_md: 'Correto! Veja a seção de origem.',
          incorrect_md: 'Reveja a seção de origem para entender o conceito.',
        },
      };
    case 'flashcard_deck':
      return {
        ...env,
        cards: [
          { id: 'card_aa1111', front_md: `Conceito ${s}`, back_md: `Definição do conceito ${s}` },
          { id: 'card_bb2222', front_md: `Termo ${s}`, back_md: `Explicação do termo ${s}` },
          { id: 'card_cc3333', front_md: `Ideia ${s}`, back_md: `Detalhe da ideia ${s}` },
        ],
      };
    case 'cloze':
      return {
        ...env,
        text_template_md: `A {{gap:g1}} é a unidade básica da vida (${s}).`,
        gaps: [{ id: 'g1', answers: ['célula', 'celula'] }],
      };
    case 'dragdrop':
      return {
        ...env,
        variant: 'ordering',
        prompt_md: 'Ordene as etapas do processo.',
        items: [
          { id: 'i1', label_md: 'Primeira etapa', correct_position: 1 },
          { id: 'i2', label_md: 'Segunda etapa', correct_position: 2 },
          { id: 'i3', label_md: 'Terceira etapa', correct_position: 3 },
        ],
      };
    case 'timeline':
      return {
        ...env,
        title_md: 'Linha do tempo do processo',
        axis: 'sequence',
        events: [
          { id: 'e1', label_md: 'Início', detail_md: 'Descrição do início.' },
          { id: 'e2', label_md: 'Meio', detail_md: 'Descrição do meio.' },
          { id: 'e3', label_md: 'Fim', detail_md: 'Descrição do fim.' },
        ],
      };
    case 'hotspot':
      return {
        ...env,
        media_asset_id: MEDIA_UUID,
        image_alt: 'Diagrama do conceito',
        spots: [
          {
            id: 'sp1',
            shape: 'circle',
            coords: [0.5, 0.5, 0.1],
            label_md: 'Ponto central',
            detail_md: 'Detalhe do ponto central.',
          },
        ],
      };
    case 'scenario':
      return {
        ...env,
        title_md: 'Cenário de decisão',
        start_node_id: 's1',
        nodes: [
          {
            id: 's1',
            kind: 'situation',
            text_md: 'Você precisa decidir o que fazer.',
            choices: [
              { label_md: 'Escolha ideal', next_node_id: 'o1', quality: 'best' },
              { label_md: 'Escolha ruim', next_node_id: 'o2', quality: 'poor' },
            ],
          },
          { id: 'o1', kind: 'outcome', text_md: 'Ótimo resultado.', outcome_score: 100 },
          { id: 'o2', kind: 'outcome', text_md: 'Resultado ruim.', outcome_score: 20 },
        ],
      };
    case 'audio':
      return {
        ...env,
        variant: 'summary',
        media_asset_id: MEDIA_UUID,
        duration_s: 120,
        transcript: [
          { t_ms: 0, speaker: 'narrator', text: 'Resumo em áudio da seção.' },
          { t_ms: 5000, speaker: 'narrator', text: 'Continuação do resumo.' },
        ],
      };
    case 'mindmap':
      return {
        ...env,
        root_id: 'n1',
        nodes: [
          { id: 'n1', label_md: 'Tema central' },
          { id: 'n2', label_md: 'Subtema A' },
          { id: 'n3', label_md: 'Subtema B' },
        ],
        edges: [
          { from: 'n1', to: 'n2', relation_md: 'inclui' },
          { from: 'n1', to: 'n3', relation_md: 'inclui' },
        ],
      };
    default: {
      const exhaustive: never = type;
      throw new Error(`tipo desconhecido: ${String(exhaustive)}`);
    }
  }
}
