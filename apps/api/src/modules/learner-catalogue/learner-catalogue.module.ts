import { Module } from '@nestjs/common';
import { LearnerCatalogueService } from './learner-catalogue.service';
import { LearnerCatalogueController } from './learner-catalogue.controller';
import { ContentAccessModule } from '../content-access/content-access.module';
import { ResourcesModule } from '../resources/resources.module';

@Module({
  imports: [ContentAccessModule, ResourcesModule],
  controllers: [LearnerCatalogueController],
  providers: [LearnerCatalogueService],
  exports: [LearnerCatalogueService],
})
export class LearnerCatalogueModule {}
