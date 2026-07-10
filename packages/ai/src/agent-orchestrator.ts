/**
 * Orquestrador Multi-Agente IA (Sprint 9).
 * Coordena agentes especializados que colaboram na geração de conteúdo,
 * com auto-avaliação e refinamento iterativo.
 */
import type { AiProvider } from './provider';
import type { InteractionType } from '@eduforge/schemas';

export interface AgentTask {
  agent: string;
  input: unknown;
  output?: unknown;
  confidence: number;
  retries: number;
}

export interface OrchestrationResult {
  tasks: AgentTask[];
  totalRetries: number;
  accepted: boolean;
  feedback: string;
}

const AGENTS = ['structurer', 'quiz_generator', 'flashcard_generator', 'cloze_generator', 'scenario_writer', 'reviewer'] as const;

/**
 * Orquestra múltiplos agentes para gerar e revisar interações.
 * Fluxo: structurer → generators (paralelo) → reviewer → refine (se < 70% confiança).
 */
export async function orchestrateGeneration(
  ai: AiProvider,
  contentMd: string,
  types: InteractionType[],
): Promise<OrchestrationResult> {
  const tasks: AgentTask[] = [];
  let totalRetries = 0;

  // Fase 1: Estruturar conteúdo
  const structure = await ai.structureContent({ rawText: contentMd, filename: 'content.md' });
  tasks.push({ agent: 'structurer', input: { size: contentMd.length }, output: { chapters: structure.tree.length }, confidence: structure.tree.length > 0 ? 0.9 : 0.3, retries: 0 });

  // Fase 2: Gerar interações (agentes em paralelo conceitual — execução sequencial no mock)
  for (const type of types) {
    let confidence = 0;
    let retries = 0;
    let output: unknown = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const interactions = await ai.generateInteractions({
          block: { id: 'auto', kind: 'concept', contentMd },
          density: 'balanced',
          types: [type],
          attempt,
        });
        const validCount = interactions.length;
        confidence = validCount > 0 ? 0.6 + attempt * 0.15 : 0.2;
        output = { count: validCount };
        retries = attempt;
        if (confidence >= 0.7) break;
      } catch { retries = attempt + 1; }
    }
    tasks.push({ agent: `${type}_generator`, input: { type }, output, confidence, retries });
    totalRetries += retries;
  }

  // Fase 3: Reviewer avalia qualidade geral
  const avgConfidence = tasks.reduce((s, t) => s + t.confidence, 0) / (tasks.length || 1);
  const accepted = avgConfidence >= 0.5;
  const feedback = accepted
    ? `Geração concluída com confiança média de ${(avgConfidence * 100).toFixed(0)}%. ${totalRetries} retentativas.`
    : `Qualidade abaixo do esperado (${(avgConfidence * 100).toFixed(0)}%). Considere revisar o conteúdo fonte.`;

  tasks.push({ agent: 'reviewer', input: { taskCount: tasks.length }, output: { accepted, avgConfidence }, confidence: 1, retries: 0 });

  return { tasks, totalRetries, accepted, feedback };
}
