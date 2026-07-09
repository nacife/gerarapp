import { Errors } from '../common/errors';
import { slugify, slugSuffix } from './domain/slug';
import type { ProjectRecord, ProjectRepository } from './ports';

export class ProjectsService {
  constructor(private readonly projects: ProjectRepository) {}

  async create(ownerUserId: string, title: string): Promise<ProjectRecord> {
    let slug = `${slugify(title)}-${slugSuffix()}`;
    for (let i = 0; i < 5 && (await this.projects.slugExists(slug)); i++) {
      slug = `${slugify(title)}-${slugSuffix()}`;
    }
    return this.projects.create({ ownerUserId, title, slug });
  }

  list(ownerUserId: string): Promise<ProjectRecord[]> {
    return this.projects.listByOwner(ownerUserId);
  }

  async get(id: string, ownerUserId: string): Promise<ProjectRecord> {
    const project = await this.projects.findByIdForOwner(id, ownerUserId);
    if (!project) throw Errors.notFound('Projeto');
    return project;
  }
}
