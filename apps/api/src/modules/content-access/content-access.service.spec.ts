import { ConfigService } from '@nestjs/config';
import { ContentLifecycle } from '@prisma/client';
import { ContentAccessService } from './content-access.service';
import { PrismaService } from '../../database/prisma.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

function config(values: Record<string, string>): ConfigService {
  return {
    get(key: string, fallback?: string) {
      return values[key] ?? fallback;
    },
  } as ConfigService;
}

describe('ContentAccessService', () => {
  const prisma = {
    course: { findUnique: jest.fn() },
    enrollment: { findUnique: jest.fn() },
    entitlement: { findFirst: jest.fn() },
  };
  const service = new ContentAccessService(
    prisma as unknown as PrismaService,
    config({
      OFFLINE_GRANT_SECRET: 'test-offline-secret',
      OFFLINE_GRANT_KID: 'redi-offline-v1',
    }),
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs and verifies an offline payload without accepting a tampered one', () => {
    const payload = JSON.stringify({ resourceId: 'res-1', exp: 100 });
    const signature = service.signOfflinePayload(payload);

    expect(service.verifyOfflineSignature(payload, signature)).toBe(true);
    expect(service.verifyOfflineSignature(payload + ' ', signature)).toBe(
      false,
    );
    expect(service.getOfflineVerificationPublic()).toMatchObject({
      kid: 'redi-offline-v1',
      algorithm: 'HMAC-SHA256',
      status: 'configured',
    });
  });

  it('grants a published free course and withholds an unpublished one', async () => {
    prisma.course.findUnique.mockResolvedValueOnce({
      id: 'course-1',
      lifecycle: ContentLifecycle.published,
      commercialMode: 'free',
    });
    await expect(
      service.resolveCourseAccess('learner-1', 'course-1'),
    ).resolves.toMatchObject({
      granted: true,
      source: 'free_course',
      canDownload: true,
    });

    prisma.course.findUnique.mockResolvedValueOnce({
      id: 'course-2',
      lifecycle: ContentLifecycle.draft,
      commercialMode: 'free',
    });
    await expect(
      service.resolveCourseAccess('learner-1', 'course-2'),
    ).resolves.toMatchObject({
      granted: false,
      reason: 'course_unavailable',
    });
  });

  it('requires an entitlement for a paid course without an active enrollment', async () => {
    prisma.course.findUnique.mockResolvedValue({
      id: 'course-1',
      lifecycle: ContentLifecycle.published,
      commercialMode: 'paid',
    });
    prisma.enrollment.findUnique.mockResolvedValue(null);
    prisma.entitlement.findFirst.mockResolvedValue(null);

    await expect(
      service.resolveCourseAccess('learner-1', 'course-1'),
    ).resolves.toMatchObject({
      granted: false,
      reason: 'entitlement_required',
    });
  });
});
