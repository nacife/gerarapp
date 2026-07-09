import { Module } from '@nestjs/common';
import { PrismaProjectRepository } from '../projects/adapters/prisma.repositories';
import { HomeController } from './home.controller';
import { AnalyticsController } from './analytics.controller';
import { HomeService } from './home.service';
import { AnalyticsService } from './analytics.service';
import { PrismaAnalyticsRepository, PrismaHomeRepository } from './adapters/prisma.repositories';

@Module({
  controllers: [HomeController, AnalyticsController],
  providers: [
    { provide: HomeService, useFactory: () => new HomeService(new PrismaHomeRepository()) },
    {
      provide: AnalyticsService,
      useFactory: () => new AnalyticsService(new PrismaProjectRepository(), new PrismaAnalyticsRepository()),
    },
  ],
})
export class CreatorModule {}
