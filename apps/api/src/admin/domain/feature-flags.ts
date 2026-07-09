import { createHash } from 'node:crypto';

/** Hash determinístico 0..99 — mesmo sujeito sempre cai no mesmo "bucket". */
export function rolloutBucket(subjectId: string, flagKey: string): number {
  const digest = createHash('sha256').update(`${flagKey}:${subjectId}`).digest();
  return digest.readUInt32BE(0) % 100;
}

export interface FlagState {
  defaultOn: boolean;
  rolloutPct: number;
}

export interface FlagAssignmentState {
  enabled: boolean;
}

/**
 * Avalia se uma flag está ligada para um sujeito (RF-13): uma atribuição
 * explícita (fixada para um usuário/org/plano) sempre vence; senão, o rollout
 * percentual decide via bucket determinístico; por fim, o default da flag.
 */
export function evaluateFlag(
  flag: FlagState,
  assignment: FlagAssignmentState | null,
  subjectId: string,
  flagKey: string,
): boolean {
  if (assignment) return assignment.enabled;
  if (flag.rolloutPct > 0) return rolloutBucket(subjectId, flagKey) < flag.rolloutPct;
  return flag.defaultOn;
}
