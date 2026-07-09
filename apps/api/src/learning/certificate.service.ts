import { collectBlockIds } from '@eduforge/schemas';
import { Errors } from '../common/errors';
import type { WebhooksService } from '../webhooks/webhooks.service';
import { generateVerifyCode } from './domain/verify-code';
import type {
  CertificatePdfBuilder,
  CertificateRecord,
  CertificateRepository,
  CertificateStorage,
  EnrollmentRepository,
  ProgressRepository,
  QrCodeGenerator,
} from './ports';

export class CertificateService {
  constructor(
    private readonly enrollments: EnrollmentRepository,
    private readonly progress: ProgressRepository,
    private readonly certificates: CertificateRepository,
    private readonly storage: CertificateStorage,
    private readonly qr: QrCodeGenerator,
    private readonly pdf: CertificatePdfBuilder,
    private readonly appBaseUrl: string,
    private readonly webhooks: WebhooksService,
  ) {}

  /** Emite o certificado se ainda não existir e todos os blocos estiverem concluídos. */
  async checkAndIssue(enrollmentId: string): Promise<CertificateRecord | null> {
    const existing = await this.certificates.findByEnrollment(enrollmentId);
    if (existing) return existing;

    const enrollment = await this.enrollments.findById(enrollmentId);
    if (!enrollment) return null;
    const manifest = await this.enrollments.getActiveManifest(enrollment.projectId);
    if (!manifest) return null;

    const totalBlocks = collectBlockIds(manifest.content);
    if (totalBlocks.length === 0) return null;
    const done = new Set(await this.progress.completedBlockIds(enrollmentId));
    const complete = totalBlocks.every((id) => done.has(id));
    if (!complete) return null;

    const certificate = await this.issue(enrollmentId);
    await this.webhooks.dispatchForProject(enrollment.projectId, 'learner.completed', { enrollmentId });
    await this.webhooks.dispatchForProject(enrollment.projectId, 'certificate.issued', {
      enrollmentId,
      verifyCode: certificate.verifyCode,
    });
    return certificate;
  }

  async issue(enrollmentId: string): Promise<CertificateRecord> {
    const ctx = await this.enrollments.getCertificateContext(enrollmentId);
    if (!ctx) throw Errors.notFound('Matrícula');

    const verifyCode = generateVerifyCode();
    const verifyUrl = `${this.appBaseUrl}/verificar/${verifyCode}`;
    const qrPng = await this.qr.toPngBuffer(verifyUrl);
    const issuedAt = new Date();
    const pdfBytes = await this.pdf.build({
      learnerName: ctx.learnerName,
      projectTitle: ctx.projectTitle,
      issuedAt,
      verifyCode,
      verifyUrl,
      qrPng,
    });

    const key = `certificates/${enrollmentId}/${verifyCode}.pdf`;
    await this.storage.put(key, pdfBytes);
    return this.certificates.create({ enrollmentId, verifyCode, pdfS3Key: key });
  }

  async verify(code: string) {
    const found = await this.certificates.findByVerifyCode(code);
    if (!found) throw Errors.notFound('Certificado');
    return found;
  }

  async getDownloadUrl(code: string): Promise<string> {
    const found = await this.certificates.findByVerifyCode(code);
    if (!found?.pdfS3Key) throw Errors.notFound('Certificado');
    return this.storage.presignGet(found.pdfS3Key);
  }
}
