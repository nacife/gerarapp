import { AI_CREDITS, QUEUES, getEnv, loadRootEnv } from '@eduforge/config';
import { createAiProvider } from '@eduforge/ai';
import { computeWebhookBackoffMs } from '@eduforge/schemas';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES } from './queues';
import { startHealthServer } from './health';
import { anonymizeUser } from './processors/anonymize';
import { runIngestion, type IngestJobData } from './ingest/pipeline';
import { MimeDocumentExtractor } from './ingest/extractor';
import { MockOcrProvider } from './ingest/ocr';
import { PrismaIngestRepository, S3IngestStorage } from './ingest/repository';
import { runGeneration, type GenerateJobData } from './generate/pipeline';
import { PrismaGenerateRepository } from './generate/repository';
import { runInpiPackageGeneration, type InpiPackageJobData } from './inpi/pipeline';
import { PrismaInpiRepository } from './inpi/repository';
import { S3WormStorage } from './inpi/s3-worm';
import { captureRuntimeScreenshots } from './inpi/screenshots';
import { loadRuntimeSnippets } from './inpi/runtime-snippets';
import { runWebhookDelivery, type WebhookDeliveryJobData } from './webhooks/pipeline';
import { PrismaWebhookDeliveryRepository } from './webhooks/repository';
import { httpPost } from './webhooks/http-client';
import { BullMqWebhookNotifier } from './webhooks/dispatch';
import { crossedLowBalanceThreshold } from './webhooks/domain/low-balance';
import { runSenseiEmbedding, type SenseiEmbedJobData } from './sensei/pipeline';
import { PrismaSenseiEmbedRepository } from './sensei/repository';
import { runPodcastGeneration, type PodcastJobData } from './podcast/pipeline';
import { PrismaPodcastRepository, S3MediaStorage } from './podcast/repository';

async function main() {
  loadRootEnv();
  const env = getEnv();

  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

  // Registra todas as filas do pipeline (produtores). Processadores reais
  // chegam nas próximas milestones.
  const queues = QUEUE_NAMES.map((name) => new Queue(name, { connection }));

  // Eventos de webhook disparados pelos jobs deste worker (Parte 6.B.4).
  const notifier = new BullMqWebhookNotifier(connection);

  // Worker de exemplo na fila 'system' — prova que o BullMQ está operante.
  const systemWorker = new Worker(
    QUEUES.system,
    async (job) => ({ handled: job.name, at: new Date().toISOString() }),
    { connection },
  );

  // Anonimização de conta (LGPD, §0.5.7).
  const anonymizeWorker = new Worker(
    QUEUES.anonymize,
    async (job) => {
      if (job.name === 'anonymize-user') {
        await anonymizeUser(String((job.data as { userId: string }).userId));
      }
    },
    { connection },
  );

  // Pipeline de ingestão (RF-01): extração → estruturação (IA) → classificação.
  const ingestPorts = {
    storage: new S3IngestStorage(),
    extractor: new MimeDocumentExtractor(),
    ocr: new MockOcrProvider(),
    ai: createAiProvider({
      provider: env.AI_PROVIDER,
      apiKey: env.ANTHROPIC_API_KEY,
      models: { structure: env.AI_MODEL_STRUCTURE, interactions: env.AI_MODEL_INTERACTIONS },
    }),
    repo: new PrismaIngestRepository(),
  };
  const ingestWorker = new Worker(
    QUEUES.ingest,
    async (job) => {
      const data = job.data as IngestJobData;
      try {
        const result = await runIngestion(data, ingestPorts);
        await notifier.dispatchForProject(data.projectId, 'ingest.completed', {
          jobId: data.jobId,
          sourceFileId: data.sourceFileId,
          contentMapId: result.contentMapId,
        });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await ingestPorts.repo.saveJob(data.jobId, { status: 'failed', error: message });
        await notifier.dispatchForProject(data.projectId, 'ingest.failed', {
          jobId: data.jobId,
          sourceFileId: data.sourceFileId,
          error: message,
        });
        throw err;
      }
    },
    { connection },
  );

  // Geração de interações (RF-02).
  const generateRepo = new PrismaGenerateRepository();
  const generateWorker = new Worker(
    QUEUES.generate,
    async (job) => {
      const data = job.data as GenerateJobData;
      try {
        const result = await runGeneration(data, { ai: ingestPorts.ai, repo: generateRepo });
        await notifier.dispatch(data.ownerUserId, data.projectId, 'interactions.generated', {
          jobId: data.jobId,
          generated: result.generated,
          pendingBlockIds: result.pendingBlockIds,
        });
        if (result.generated > 0) {
          const balance = await generateRepo.creditBalance(data.ownerUserId);
          const debited = result.generated * AI_CREDITS.costPerInteraction;
          if (crossedLowBalanceThreshold(balance, debited, AI_CREDITS.lowBalanceThreshold)) {
            // Evento de conta, não de projeto (saldo é do usuário) — projectId null.
            await notifier.dispatch(data.ownerUserId, null, 'credits.low_balance', {
              balance,
              threshold: AI_CREDITS.lowBalanceThreshold,
            });
          }
        }
        return result;
      } catch (err) {
        await generateRepo.saveJob(data.jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    { connection },
  );

  // Pacote INPI (RF-16): memorial (IA) + telas + ZIP canônico + hash + declaração.
  const inpiRepo = new PrismaInpiRepository();
  const inpiStorage = new S3WormStorage();
  const inpiWorker = new Worker(
    QUEUES.inpiPackage,
    async (job) => {
      const data = job.data as InpiPackageJobData;
      try {
        const result = await runInpiPackageGeneration(data, {
          ai: ingestPorts.ai,
          repo: inpiRepo,
          storage: inpiStorage,
          captureScreenshots: captureRuntimeScreenshots,
          runtimeBaseUrl: env.RUNTIME_BASE_URL,
          apiBaseUrl: `http://localhost:${env.API_PORT}`,
          loadSnippets: loadRuntimeSnippets,
        });
        await notifier.dispatchForProject(result.projectId, 'inpi.package.ready', {
          certificateId: result.certificateId,
          bundleHashSha512: result.bundleHashSha512,
        });
        return result;
      } catch (err) {
        await inpiRepo.saveJob(data.jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    { connection },
  );

  // Entrega de webhooks (Parte 6.B.4): assina, envia, registra e retenta
  // (backoff exponencial com cap de 4h — ~24h de janela total de retry).
  const webhookRepo = new PrismaWebhookDeliveryRepository();
  const webhookWorker = new Worker(
    QUEUES.webhookDelivery,
    async (job) => {
      const data = job.data as WebhookDeliveryJobData;
      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = attemptsMade + 1 >= maxAttempts;
      await runWebhookDelivery(data, attemptsMade, isFinalAttempt, {
        getEndpoint: (id) => webhookRepo.getEndpoint(id),
        recordAttempt: (id, patch) => webhookRepo.recordAttempt(id, patch),
        post: httpPost,
        encryptionKey: env.AUTH_ENCRYPTION_KEY,
      });
    },
    { connection, settings: { backoffStrategy: (attemptsMade) => computeWebhookBackoffMs(attemptsMade) } },
  );

  // Indexação do RAG do Sensei (RF-06.1): embeda blocos do mapa aprovado no publish.
  const senseiRepo = new PrismaSenseiEmbedRepository();
  const senseiWorker = new Worker(
    QUEUES.senseiEmbed,
    async (job) => {
      const data = job.data as SenseiEmbedJobData;
      return runSenseiEmbedding(data, { ai: ingestPorts.ai, repo: senseiRepo });
    },
    { connection },
  );

  // Podcast/TTS (RF-06.5): roteiro → síntese de fala → upload WAV → media_assets.
  const podcastRepo = new PrismaPodcastRepository();
  const podcastStorage = new S3MediaStorage();
  const podcastWorker = new Worker(
    QUEUES.tts,
    async (job) => {
      const data = job.data as PodcastJobData;
      try {
        return await runPodcastGeneration(data, {
          ai: ingestPorts.ai,
          repo: podcastRepo,
          storage: podcastStorage,
          appTitle: data.appTitle,
        });
      } catch (err) {
        await podcastRepo.saveJob(data.jobId, {
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    { connection },
  );

  const workers = [systemWorker, anonymizeWorker, ingestWorker, generateWorker, inpiWorker, webhookWorker, senseiWorker, podcastWorker];
  for (const w of workers) {
    w.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(`job ${job?.id ?? '?'} (${w.name}) falhou:`, err.message);
    });
  }

  const server = startHealthServer(env.WORKER_PORT, connection);

  const shutdown = async () => {
    await Promise.all(workers.map((w) => w.close()));
    await Promise.all(queues.map((q) => q.close()));
    server.close();
    await connection.quit();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // eslint-disable-next-line no-console
  console.log(
    `🛠️  Worker EduForge — filas: ${QUEUE_NAMES.join(', ')} — health em http://localhost:${env.WORKER_PORT}/health`,
  );
}

void main();
