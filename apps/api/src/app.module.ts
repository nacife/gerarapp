import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';
import { InteractionsModule } from './interactions/interactions.module';
import { StudioModule } from './studio/studio.module';
import { LearningModule } from './learning/learning.module';
import { AdminModule } from './admin/admin.module';
import { CreatorModule } from './creator/creator.module';
import { InpiModule } from './inpi/inpi.module';
import { FilingModule } from './inpi-filing/filing.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { OpenApiModule } from './openapi/openapi.module';
import { SenseiModule } from './sensei/sensei.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    ProjectsModule,
    InteractionsModule,
    StudioModule,
    LearningModule,
    SenseiModule,
    MediaModule,
    AdminModule,
    CreatorModule,
    InpiModule,
    FilingModule,
    ApiKeysModule,
    WebhooksModule,
    OpenApiModule,
  ],
})
export class AppModule {}
