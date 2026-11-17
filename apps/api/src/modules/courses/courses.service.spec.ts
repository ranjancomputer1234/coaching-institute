import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditSeverity, ContentLifecycle } from '@prisma/client';
import { CoursesService } from './courses.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CloudinaryService } from '../resources/cloudinary.service';

jest.mock('@nestjs/config', () => ({
  ConfigService: class ConfigService {},
}));

describe('CoursesService.publishLesson', () => {
  const prisma = {
    lesson: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
  const audit = { write: jest.fn() };
  const cloudinary = { createSignedImageUpload: jest.fn() };
  const service = new CoursesService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    cloudinary as unknown as CloudinaryService,
  );
  const actor = { userId: 'admin-1', email: 'admin@test.local' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('publishes a draft lesson on the matching course', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      lifecycle: ContentLifecycle.draft,
    });
    prisma.lesson.update.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      lifecycle: ContentLifecycle.published,
    });

    await expect(
      service.publishLesson('course-1', 'lesson-1', actor),
    ).resolves.toMatchObject({ lifecycle: ContentLifecycle.published });

    expect(prisma.lesson.update).toHaveBeenCalledWith({
      where: { id: 'lesson-1' },
      data: { lifecycle: ContentLifecycle.published },
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'lesson.publish',
        resourceId: 'lesson-1',
        severity: AuditSeverity.notice,
      }),
    );
  });

  it('rejects lessons that do not belong to the course', async () => {
    prisma.lesson.findFirst.mockResolvedValue(null);
    await expect(
      service.publishLesson('course-1', 'lesson-x', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects archived lessons', async () => {
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      courseId: 'course-1',
      lifecycle: ContentLifecycle.archived,
    });
    await expect(
      service.publishLesson('course-1', 'lesson-1', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
