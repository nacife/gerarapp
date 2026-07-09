import type { CatalogRepository } from './ports';

export class CatalogService {
  constructor(private readonly repo: CatalogRepository) {}

  templates() {
    return this.repo.listTemplates();
  }

  palettes() {
    return this.repo.listPalettes();
  }
}
