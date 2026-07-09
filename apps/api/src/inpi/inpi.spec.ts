import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AppError } from '../common/errors';
import { InpiService } from './inpi.service';
import {
  FakeInpiEnqueuer,
  FakeInpiStorage,
  InMemoryInpiCertificateRepository,
  InMemoryInpiJobRepository,
  InMemoryInpiProjectRepository,
} from './testing/fakes';

const OWNER = 'owner-1';

async function expectError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('esperava AppError');
}

function build() {
  const projects = new InMemoryInpiProjectRepository();
  const certificates = new InMemoryInpiCertificateRepository();
  const jobs = new InMemoryInpiJobRepository();
  const enqueuer = new FakeInpiEnqueuer();
  const storage = new FakeInpiStorage();
  const service = new InpiService(projects, certificates, jobs, enqueuer, storage);
  return { service, projects, certificates, jobs, enqueuer, storage };
}

describe('InpiService.generatePackage (US-INPI-01)', () => {
  it('versão publicada sem certificação → enfileira job', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    kit.projects.seedPublishedVersion(project.id, 3);

    const { jobId } = await kit.service.generatePackage(project.id, OWNER, 3);
    expect(jobId).toBeTruthy();
    expect(kit.enqueuer.enqueued).toHaveLength(1);
    expect(kit.enqueuer.enqueued[0]!.requestedById).toBe(OWNER);
  });

  it('sem versão publicada → app-not-published, nenhum job enfileirado', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);

    const err = await expectError(() => kit.service.generatePackage(project.id, OWNER));
    expect(err.slug).toBe('app-not-published');
    expect(kit.enqueuer.enqueued).toHaveLength(0);
  });

  it('versão já certificada → conflito, nenhum job novo', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    const version = kit.projects.seedPublishedVersion(project.id, 3);
    kit.certificates.seed({
      projectId: project.id,
      ownerUserId: OWNER,
      appVersionId: version.appVersionId,
      versionNumber: 3,
    });

    const err = await expectError(() => kit.service.generatePackage(project.id, OWNER, 3));
    expect(err.slug).toBe('conflict');
    expect(kit.enqueuer.enqueued).toHaveLength(0);
  });

  it('projeto de outro dono → not-found', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    kit.projects.seedPublishedVersion(project.id, 1);
    const err = await expectError(() => kit.service.generatePackage(project.id, 'intruso'));
    expect(err.slug).toBe('not-found');
  });

  it('sem indicar versão, usa a mais recente publicada', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    kit.projects.seedPublishedVersion(project.id, 1);
    kit.projects.seedPublishedVersion(project.id, 2);
    await kit.service.generatePackage(project.id, OWNER);
    expect(kit.jobs.created).toHaveLength(1);
  });
});

describe('InpiService.listForProject / getCertificate', () => {
  it('lista certificados do projeto e nega acesso a outro dono', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    const version = kit.projects.seedPublishedVersion(project.id, 1);
    kit.certificates.seed({ projectId: project.id, ownerUserId: OWNER, appVersionId: version.appVersionId });

    const list = await kit.service.listForProject(project.id, OWNER);
    expect(list).toHaveLength(1);

    const err = await expectError(() => kit.service.listForProject(project.id, 'intruso'));
    expect(err.slug).toBe('not-found');
  });

  it('getCertificate inclui URLs assinadas e a Ficha de Registro', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER, { title: 'Biologia Viva', slug: 'biologia-viva' });
    const version = kit.projects.seedPublishedVersion(project.id, 3);
    const cert = kit.certificates.seed({
      projectId: project.id,
      ownerUserId: OWNER,
      appVersionId: version.appVersionId,
      versionNumber: 3,
    });

    const view = await kit.service.getCertificate(cert.id, OWNER);
    expect(view.zipUrl).toContain(cert.manifestCanonicalS3Key);
    expect(view.declarationUrl).toContain(cert.declarationPdfS3Key);
    expect(view.tsaUrl).toBeNull();
    expect(view.fichaRegistro.suggestedTitle).toBe('Biologia Viva (v3)');
    expect(view.fichaRegistro.derivationText).toContain('biologia-viva');
  });

  it('certificado de outro dono → not-found', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    const version = kit.projects.seedPublishedVersion(project.id, 1);
    const cert = kit.certificates.seed({ projectId: project.id, ownerUserId: OWNER, appVersionId: version.appVersionId });

    const err = await expectError(() => kit.service.getCertificate(cert.id, 'intruso'));
    expect(err.slug).toBe('not-found');
  });
});

describe('InpiService.verify (RF-16.4)', () => {
  it('hash recalculado bate com o registrado → matched:true e grava verificação', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    const version = kit.projects.seedPublishedVersion(project.id, 1);
    const bytes = Buffer.from('conteudo do pacote congelado');
    const bundleHash = createHash('sha512').update(bytes).digest('hex');
    const cert = kit.certificates.seed({
      projectId: project.id,
      ownerUserId: OWNER,
      appVersionId: version.appVersionId,
      bundleHash,
      manifestCanonicalS3Key: 'inpi/pkg.zip',
    });
    kit.storage.seedFile('inpi/pkg.zip', bytes);

    const result = await kit.service.verify(cert.id, OWNER, OWNER);
    expect(result.matched).toBe(true);
    expect(result.recomputedHash).toBe(bundleHash);

    const detail = await kit.certificates.findById(cert.id);
    expect(detail?.lastVerification?.matched).toBe(true);
  });

  it('bytes divergentes do congelado → matched:false (integridade violada)', async () => {
    const kit = build();
    const project = kit.projects.seedProject(OWNER);
    const version = kit.projects.seedPublishedVersion(project.id, 1);
    const cert = kit.certificates.seed({
      projectId: project.id,
      ownerUserId: OWNER,
      appVersionId: version.appVersionId,
      bundleHash: createHash('sha512').update('original').digest('hex'),
      manifestCanonicalS3Key: 'inpi/pkg.zip',
    });
    kit.storage.seedFile('inpi/pkg.zip', Buffer.from('bytes adulterados'));

    const result = await kit.service.verify(cert.id, OWNER, OWNER);
    expect(result.matched).toBe(false);
  });
});
