import { Errors } from '../common/errors';
import type { JobRecord, JobRepository } from './ports';

export class JobsService {
  constructor(private readonly jobs: JobRepository) {}

  async get(id: string, ownerUserId: string): Promise<JobRecord> {
    const job = await this.jobs.findByIdWithOwner(id);
    if (!job || (job.ownerUserId != null && job.ownerUserId !== ownerUserId)) {
      throw Errors.notFound('Job');
    }
    return job;
  }
}
