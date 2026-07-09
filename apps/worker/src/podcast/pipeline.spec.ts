import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '@eduforge/ai';
import { runPodcastGeneration, type PodcastRepository, type PodcastStorage } from './pipeline';

class FakeRepo implements PodcastRepository {
  constructor(private sections: { title: string; contentMd: string }[]) {}
  public assets: { projectId: string; s3Key: string; kind: string; meta: unknown }[] = [];
  public jobStatus: { jobId: string; status: string; error?: string } | null = null;

  async getChapterSections() {
    return this.sections;
  }

  async createMediaAsset(input: {
    projectId: string;
    s3Key: string;
    kind: string;
    meta: unknown;
  }) {
    this.assets.push(input);
    return { id: 'asset-1' };
  }

  async saveJob(jobId: string, patch: { status: 'completed' | 'failed'; error?: string }) {
    this.jobStatus = { jobId, ...patch };
  }
}

class FakeStorage implements PodcastStorage {
  public uploaded: { key: string; bytes: Buffer; contentType: string }[] = [];

  async put(key: string, bytes: Buffer, contentType: string) {
    this.uploaded.push({ key, bytes, contentType });
  }
}

const ai = new MockAiProvider();

describe('runPodcastGeneration', () => {
  it('gera podcast completo: roteiro → áudio → upload → media_asset', async () => {
    const repo = new FakeRepo([
      { title: 'Introdução', contentMd: 'Neste capítulo veremos a fotossíntese.' },
      { title: 'Fase Clara', contentMd: 'A fase clara ocorre nos tilacoides e produz ATP e NADPH.' },
      { title: 'Ciclo de Calvin', contentMd: 'O ciclo de Calvin fixa o carbono em glicose.' },
    ]);
    const storage = new FakeStorage();

    const out = await runPodcastGeneration(
      { jobId: 'job-1', projectId: 'p1', chapterId: 'ch1', appTitle: 'Biologia Viva' },
      { ai, repo, storage, appTitle: 'Biologia Viva' },
    );

    // Roteiro gerado.
    expect(repo.assets).toHaveLength(1);
    expect(repo.assets[0].kind).toBe('podcast');
    expect(repo.assets[0].s3Key).toBe('media/podcasts/p1/ch1.wav');
    const meta = repo.assets[0].meta as any;
    expect(meta.chapterId).toBe('ch1');
    expect(meta.transcript.length).toBeGreaterThan(0);
    expect(meta.durationSec).toBeGreaterThan(0);

    // Áudio WAV enviado ao storage.
    expect(storage.uploaded).toHaveLength(1);
    expect(storage.uploaded[0].contentType).toBe('audio/wav');
    expect(storage.uploaded[0].bytes.length).toBeGreaterThan(0);

    // Job concluído.
    expect(repo.jobStatus?.status).toBe('completed');

    // Retorno com dados.
    expect(out.mediaAssetId).toBe('asset-1');
    expect(out.durationSec).toBeGreaterThan(0);
  });

  it('lança erro quando o capítulo não tem seções', async () => {
    const repo = new FakeRepo([]);
    const storage = new FakeStorage();

    await expect(
      runPodcastGeneration(
        { jobId: 'job-1', projectId: 'p1', chapterId: 'ch1', appTitle: 'Biologia Viva' },
        { ai, repo, storage, appTitle: 'Test' },
      ),
    ).rejects.toThrow('Capítulo');
  });

  it('roteiro tem dois apresentadores (A e B)', async () => {
    const repo = new FakeRepo([
      { title: 'Tópico', contentMd: 'Conteúdo de teste sobre biologia celular.' },
    ]);
    const storage = new FakeStorage();

    await runPodcastGeneration(
      { jobId: 'job-1', projectId: 'p1', chapterId: 'ch1', appTitle: 'Biologia Viva' },
      { ai, repo, storage, appTitle: 'Test' },
    );

    const meta = repo.assets[0].meta as any;
    const speakers = new Set(meta.transcript.map((l: any) => l.speaker));
    expect(speakers.has('A')).toBe(true);
    expect(speakers.has('B')).toBe(true);
  });
});
