import type { z } from 'zod';
import type { InteractionType } from './envelope';
import { quizSchema, quizSemantic } from './quiz';
import { flashcardDeckSchema, flashcardDeckSemantic } from './flashcard';
import { clozeSchema, clozeSemantic } from './cloze';
import { dragdropSchema, dragdropSemantic } from './dragdrop';
import { timelineSchema, timelineSemantic } from './timeline';
import { hotspotSchema, hotspotSemantic } from './hotspot';
import { scenarioSchema, scenarioSemantic } from './scenario';
import { audioSchema, audioSemantic } from './audio';
import { mindmapSchema, mindmapSemantic } from './mindmap';

interface InteractionSpec {
  schema: z.ZodTypeAny;
  semantic: (payload: never) => string[];
}

/** Fonte única: schema Zod + validador semântico por tipo (Parte 6.A). */
export const INTERACTION_SPECS: Record<InteractionType, InteractionSpec> = {
  quiz: { schema: quizSchema, semantic: quizSemantic as (p: never) => string[] },
  flashcard_deck: {
    schema: flashcardDeckSchema,
    semantic: flashcardDeckSemantic as (p: never) => string[],
  },
  cloze: { schema: clozeSchema, semantic: clozeSemantic as (p: never) => string[] },
  dragdrop: { schema: dragdropSchema, semantic: dragdropSemantic as (p: never) => string[] },
  timeline: { schema: timelineSchema, semantic: timelineSemantic as (p: never) => string[] },
  hotspot: { schema: hotspotSchema, semantic: hotspotSemantic as (p: never) => string[] },
  scenario: { schema: scenarioSchema, semantic: scenarioSemantic as (p: never) => string[] },
  audio: { schema: audioSchema, semantic: audioSemantic as (p: never) => string[] },
  mindmap: { schema: mindmapSchema, semantic: mindmapSemantic as (p: never) => string[] },
};

export interface ValidationResult {
  ok: boolean;
  type?: InteractionType;
  errors: string[];
  /** Payload normalizado (defaults aplicados) quando válido. */
  data?: unknown;
}

/**
 * Valida um payload de interação: schema JSON (Zod) + regras semânticas.
 * É o portão único de "nenhum payload inválido persiste" (US-IA-01).
 */
export function validateInteraction(payload: unknown): ValidationResult {
  if (typeof payload !== 'object' || payload === null || !('type' in payload)) {
    return { ok: false, errors: ['payload sem campo "type".'] };
  }
  const type = (payload as { type: unknown }).type;
  if (typeof type !== 'string' || !(type in INTERACTION_SPECS)) {
    return { ok: false, errors: [`tipo de interação inválido: ${String(type)}`] };
  }
  const key = type as InteractionType;
  const spec = INTERACTION_SPECS[key];

  const parsed = spec.schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      type: key,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`),
    };
  }

  const semanticErrors = spec.semantic(parsed.data as never);
  if (semanticErrors.length > 0) {
    return { ok: false, type: key, errors: semanticErrors };
  }
  return { ok: true, type: key, errors: [], data: parsed.data };
}
