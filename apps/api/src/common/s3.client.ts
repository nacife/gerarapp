import { S3Client } from '@aws-sdk/client-s3';
import { getEnv } from '@eduforge/config';

/**
 * Cria uma instância do S3Client configurada para o ambiente atual.
 * Compatível com MinIO local, AWS S3 e Cloudflare R2 (com endpoint customizado e region 'auto').
 */
export function createS3Client(): S3Client {
  const env = getEnv();
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });
}
