import type { AiProvider } from '@eduforge/ai';

export interface PodcastJobData {
  jobId: string;
  projectId: string;
  chapterId: string;
  appTitle: string;
}

export interface ChapterSection {
  title: string;
  contentMd: string;
}

export interface PodcastRepository {
  /** Seções do capítulo a partir do mapa aprovado (revisão mais alta). */
  getChapterSections(projectId: string, chapterId: string): Promise<ChapterSection[]>;
  /** Cria registro em media_assets e retorna o id. */
  createMediaAsset(input: {
    projectId: string;
    s3Key: string;
    kind: string;
    meta: unknown;
  }): Promise<{ id: string }>;
  /** Salva status do job (sucesso ou falha). */
  saveJob(
    jobId: string,
    patch: { status: 'completed' | 'failed'; error?: string },
  ): Promise<void>;
}

export interface PodcastStorage {
  /** Upload do áudio WAV para S3. Retorna a chave usada. */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
}

export interface PodcastPorts {
  ai: Pick<AiProvider, 'generatePodcastScript' | 'synthesizeSpeech'>;
  repo: PodcastRepository;
  storage: PodcastStorage;
  appTitle: string;
}

/**
 * Gera o podcast de um capítulo (RF-06.5). Pipeline:
 * 1. Carrega seções do mapa aprovado
 * 2. Gera roteiro (dois apresentadores) via AI
 * 3. Sintetiza fala (WAV)
 * 4. Upload para S3
 * 5. Registra em media_assets
 */
export async function runPodcastGeneration(
  data: PodcastJobData,
  ports: PodcastPorts,
): Promise<{ mediaAssetId: string; s3Key: string; title: string; durationSec: number }> {
  // 1. Carrega seções do capítulo.
  const sections = await ports.repo.getChapterSections(data.projectId, data.chapterId);
  if (sections.length === 0) {
    throw new Error(`Capítulo ${data.chapterId} não encontrado no mapa aprovado.`);
  }

  const chapterTitle = sections[0]?.title ?? 'Capítulo';

  // 2. Gera roteiro.
  const script = await ports.ai.generatePodcastScript({
    appTitle: ports.appTitle,
    chapterTitle,
    sections: sections.map((s) => ({ title: s.title, contentMd: s.contentMd })),
  });

  // 3. Sintetiza fala.
  const audio = await ports.ai.synthesizeSpeech({ lines: script.lines });

  // 4. Upload para S3.
  const s3Key = `media/podcasts/${data.projectId}/${data.chapterId}.wav`;
  await ports.storage.put(s3Key, audio.audio, audio.mimeType);

  // 5. Registra media_asset.
  const asset = await ports.repo.createMediaAsset({
    projectId: data.projectId,
    s3Key,
    kind: 'podcast',
    meta: {
      chapterId: data.chapterId,
      title: script.title,
      transcript: script.lines,
      durationSec: audio.durationSec,
    },
  });

  await ports.repo.saveJob(data.jobId, { status: 'completed' });

  return {
    mediaAssetId: asset.id,
    s3Key,
    title: script.title,
    durationSec: audio.durationSec,
  };
}
