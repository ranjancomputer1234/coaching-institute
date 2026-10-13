import { Injectable } from '@nestjs/common';
import { ContentLifecycle, LearnerAccountState } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      total,
      active,
      suspended,
      pendingVerification,
      enrollments,
      publishedCourses,
      draftCourses,
      explorePublished,
      bannersPublished,
      bannersScheduled,
      courseReview,
      exploreReview,
      bannerReview,
      recentAudit,
    ] = await Promise.all([
      this.prisma.learner.count(),
      this.prisma.learner.count({
        where: { accountState: LearnerAccountState.active },
      }),
      this.prisma.learner.count({
        where: { accountState: LearnerAccountState.suspended },
      }),
      this.prisma.learner.count({
        where: { accountState: LearnerAccountState.pending_verification },
      }),
      this.prisma.enrollment.count(),
      this.prisma.course.count({
        where: { lifecycle: ContentLifecycle.published },
      }),
      this.prisma.course.count({
        where: { lifecycle: ContentLifecycle.draft },
      }),
      this.prisma.exploreSection.count({
        where: { lifecycle: ContentLifecycle.published },
      }),
      this.prisma.banner.count({
        where: { lifecycle: ContentLifecycle.published },
      }),
      this.prisma.banner.count({
        where: { lifecycle: ContentLifecycle.scheduled },
      }),
      this.prisma.course.count({
        where: { lifecycle: ContentLifecycle.in_review },
      }),
      this.prisma.exploreSection.count({
        where: { lifecycle: ContentLifecycle.in_review },
      }),
      this.prisma.banner.count({
        where: { lifecycle: ContentLifecycle.in_review },
      }),
      this.prisma.auditEvent.findMany({
        orderBy: { occurredAtUtc: 'desc' },
        take: 8,
        select: {
          id: true,
          occurredAtUtc: true,
          actorDisplay: true,
          action: true,
          resourceType: true,
        },
      }),
    ]);

    return {
      learners: { total, active, suspended, pendingVerification },
      enrollments: { total: enrollments },
      courses: { published: publishedCourses, draft: draftCourses },
      explore: { published: explorePublished },
      banners: { published: bannersPublished, scheduled: bannersScheduled },
      queues: {
        draftsAwaitingReview: courseReview + exploreReview + bannerReview,
        suspendedLearners: suspended,
      },
      recentAudit,
    };
  }
}
