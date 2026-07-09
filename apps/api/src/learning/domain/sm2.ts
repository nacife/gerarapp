export interface Sm2State {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export interface Sm2Result extends Sm2State {
  nextReviewAt: Date;
}

/**
 * SuperMemo-2 (RF-02 flashcards). `quality` 0..5 (Anki-like: 1=esqueci,
 * 3=difícil, 4=bom, 5=fácil). Granularidade por bloco de conteúdo — ADR-0037.
 */
export function sm2(prev: Sm2State, quality: number, now: Date = new Date()): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));

  let repetitions: number;
  let intervalDays: number;
  if (q < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = prev.repetitions + 1;
    if (prev.repetitions === 0) intervalDays = 1;
    else if (prev.repetitions === 1) intervalDays = 6;
    else intervalDays = Math.round(prev.intervalDays * prev.easeFactor);
  }

  const easeFactor = Math.max(
    1.3,
    prev.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return { easeFactor, intervalDays, repetitions, nextReviewAt };
}
