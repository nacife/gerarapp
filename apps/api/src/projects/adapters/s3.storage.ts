import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '@eduforge/config';
import type { Storage } from '../ports';

/** Armazenamento S3/MinIO com URLs pré-assinadas de PUT (RF-01). */
export class S3Storage implements Storage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const env = getEnv();
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true, // MinIO usa path-style
      credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    });
    this.bucket = env.S3_BUCKET_UPLOADS;
  }

  async presignPut(key: string): Promise<{ url: string; key: string }> {
    // Não assinamos Content-Type para não exigir header exato no cliente.
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: 900 });
    return { url, key };
  }
}
