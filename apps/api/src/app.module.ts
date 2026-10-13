import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { apiEnvFilePath } from './config/api-env-file';
import { DatabaseModule } from './database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LearnersModule } from './modules/learners/learners.module';
import { BatchesModule } from './modules/batches/batches.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ExploreModule } from './modules/explore/explore.module';
import { BannersModule } from './modules/banners/banners.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditEventsModule } from './modules/audit-events/audit-events.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { TestsModule } from './modules/tests/tests.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { ResultsModule } from './modules/results/results.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { SemesterReviewsModule } from './modules/semester-reviews/semester-reviews.module';
import { LearnerAuthModule } from './modules/learner-auth/learner-auth.module';
import { LearnerCatalogueModule } from './modules/learner-catalogue/learner-catalogue.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { ContentAccessModule } from './modules/content-access/content-access.module';
import { PlatformModule } from './modules/platform/platform.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: apiEnvFilePath(),
    }),
    DatabaseModule,
    AuditModule,
    UsersModule,
    AuthModule,
    LearnersModule,
    BatchesModule,
    CoursesModule,
    ExploreModule,
    BannersModule,
    DashboardModule,
    AuditEventsModule,
    QuestionsModule,
    TestsModule,
    AttemptsModule,
    ResultsModule,
    ProjectsModule,
    SemesterReviewsModule,
    ContentAccessModule,
    LearnerAuthModule,
    LearnerCatalogueModule,
    ResourcesModule,
    DocumentsModule,
    EntitlementsModule,
    PlatformModule,
    HealthModule,
  ],
})
export class AppModule {}
