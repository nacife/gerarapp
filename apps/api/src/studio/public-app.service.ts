import { Errors } from '../common/errors';
import type { SecretHasher, StudioRepository } from './ports';

/** Serve o manifesto do app publicado por slug, respeitando o modo de acesso. */
export class PublicAppService {
  constructor(
    private readonly repo: StudioRepository,
    private readonly hasher: SecretHasher,
  ) {}

  async getManifest(slug: string, key?: string): Promise<unknown> {
    const found = await this.repo.getActiveManifestBySlug(slug);
    if (!found) throw Errors.notFound('App');

    if (found.accessMode === 'invite') {
      throw Errors.appLocked(); // conta de aprendiz chega na M5
    }
    if (found.accessMode === 'password') {
      const ok =
        !!key && !!found.accessSecret && (await this.hasher.verify(found.accessSecret, key));
      if (!ok) throw Errors.appLocked(); // sem senha → nenhum conteúdo (US-PUB-01)
    }
    // public + link → serve
    return found.manifest;
  }
}
