import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getEnv } from '@eduforge/config';
import { createS3Client } from '../common/s3.client';

/**
 * Armazenamento do pacote canônico e da Declaração de Integridade (RF-16.2):
 * bucket dedicado (`S3_BUCKET_WORM`), gravado uma única vez por versão — nunca
 * sobrescrito/apagado pela aplicação (convenção de código; o MinIO local não
 * impõe object-lock, mas nenhuma rota da API expõe update/delete para esta chave).
 */
export class S3WormStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = createS3Client();
    this.bucket = getEnv().S3_BUCKET_WORM;
  }

  async put(key: string, bytes: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }
}
