import type { CatalogRepository } from './ports';
import type { CacheService } from '../common/cache.service';

export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly cache?: CacheService,
  ) {}

  templates() {
    if (!this.cache) return this.repo.listTemplates();
    return this.cache.wrap('catalog:templates', () => this.repo.listTemplates(), 600);
  }

  palettes() {
    if (!this.cache) return this.repo.listPalettes();
    return this.cache.wrap('catalog:palettes', () => this.repo.listPalettes(), 600);
  }
}
