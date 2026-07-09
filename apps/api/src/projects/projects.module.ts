import { Module } from '@nestjs/common';
import IORedis, { type Redis } from 'ioredis';
import { getEnv } from '@eduforge/config';
import { ProjectsController } from './projects.controller';
import { SourceFilesController } from './source-files.controller';
import { JobsController } from './jobs.controller';
import { ProjectsService } from './projects.service';
import { SourceFilesService } from './source-files.service';
import { ContentMapService } from './content-map.service';
import { JobsService } from './jobs.service';
import {
  PrismaContentMapRepository,
  PrismaJobRepository,
  PrismaProjectRepository,
  PrismaSourceFileRepository,
} from './adapters/prisma.repositories';
import { S3Storage } from './adapters/s3.storage';
import { BullMqIngestEnqueuer } from './adapters/enqueuer';

const PROJECTS_REDIS = Symbol('PROJECTS_REDIS');

@Module({
  controllers: [ProjectsController, SourceFilesController, JobsController],
  providers: [
    {
      provide: PROJECTS_REDIS,
      useFactory: (): Redis => new IORedis(getEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: ProjectsService,
      useFactory: () => new ProjectsService(new PrismaProjectRepository()),
    },
    {
      provide: ContentMapService,
      useFactory: () =>
        new ContentMapService(new PrismaProjectRepository(), new PrismaContentMapRepository()),
    },
    {
      provide: JobsService,
      useFactory: () => new JobsService(new PrismaJobRepository()),
    },
    {
      provide: SourceFilesService,
      inject: [PROJECTS_REDIS],
      useFactory: (redis: Redis) =>
        new SourceFilesService(
          new PrismaProjectRepository(),
          new PrismaSourceFileRepository(),
          new PrismaJobRepository(),
          new S3Storage(),
          new BullMqIngestEnqueuer(redis),
        ),
    },
  ],
})
export class ProjectsModule {}
