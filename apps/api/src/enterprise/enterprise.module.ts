import { Module } from '@nestjs/common';
import { SsoController } from './sso.controller';
import { ScormController } from './scorm.controller';

@Module({
  controllers: [SsoController, ScormController],
})
export class EnterpriseModule {}
