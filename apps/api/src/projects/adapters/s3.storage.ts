import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '@eduforge/config';
import { createS3Client } from '../../common/s3.client';
import type { Storage } from '../ports';

/** Armazenamento S3/MinIO/R2 com URLs pré-assinadas de PUT (RF-01). */
export class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.client = createS3Client();
    this.bucket = getEnv().S3_BUCKET_UPLOADS;
  }

  async presignPut(key: string): Promise<{ url: string; key: string }> {
    // Não assinamos Content-Type para não exigir header exato no cliente.
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: 900 });
    return { url, key };
  }
}
