import { PrismaClient, ContentLifecycle, ExploreCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  ALL_PERMISSIONS,
  ROLE_META,
  ROLE_PERMISSIONS,
} from '../src/common/permissions/permissions';

const prisma = new PrismaClient();

async function main() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const meta = ROLE_META[roleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: meta.name, description: meta.description },
      create: {
        key: roleKey,
        name: meta.name,
        description: meta.description,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const perm of perms) {
      const permissionId = permissionByKey.get(perm);
      if (!permissionId) continue;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@institute.local' },
    update: { name: 'REDI Super Admin', passwordHash, isActive: true },
    create: {
      email: 'admin@institute.local',
      name: 'REDI Super Admin',
      passwordHash,
    },
  });

  const superRole = await prisma.role.findUniqueOrThrow({
    where: { key: 'super_admin' },
  });
  await prisma.adminRoleAssignment.upsert({
    where: {
      adminId_roleId: { adminId: admin.id, roleId: superRole.id },
    },
    update: {},
    create: { adminId: admin.id, roleId: superRole.id },
  });

  const course = await prisma.course.upsert({
    where: { slug: 'tally-prime-basics' },
    update: {},
    create: {
      slug: 'tally-prime-basics',
      title: 'Tally Prime Basics',
      shortTitle: 'Tally Free',
      summary: 'Introductory Tally Prime course',
      commercialMode: 'free',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      featured: true,
    },
  });

  const existingLesson = await prisma.lesson.findFirst({
    where: { courseId: course.id, title: 'Getting started' },
  });
  if (!existingLesson) {
    await prisma.lesson.create({
      data: {
        courseId: course.id,
        title: 'Getting started',
        sortOrder: 0,
        durationMinutes: 12,
        contentType: 'video',
        isPreview: true,
        lifecycle: ContentLifecycle.published,
      },
    });
  }

  const batch = await prisma.batch.upsert({
    where: { id: 'seed-batch-redi' },
    update: {},
    create: {
      id: 'seed-batch-redi',
      code: 'REDI-2026-A',
      name: 'REDI Morning Cohort',
      subject: 'Computer + Exams',
      courseId: course.id,
      startDate: new Date('2026-01-01'),
      timezone: 'Asia/Kolkata',
      capacity: 40,
    },
  });

  const riya = await prisma.learner.upsert({
    where: { email: 'riya@learner.local' },
    update: {},
    create: {
      firstName: 'Riya',
      lastName: 'Sharma',
      email: 'riya@learner.local',
      phone: '9876543210',
      phoneNormalized: '9876543210',
      city: 'Patna',
      accountState: 'active',
      verifiedEmail: true,
      verifiedPhone: true,
      batchId: batch.id,
      source: 'seed',
    },
  });

  await prisma.learner.upsert({
    where: { email: 'arjun@learner.local' },
    update: {},
    create: {
      firstName: 'Arjun',
      lastName: 'Patel',
      email: 'arjun@learner.local',
      phone: '9876543211',
      phoneNormalized: '9876543211',
      city: 'Ranchi',
      accountState: 'active',
      verifiedEmail: true,
      batchId: batch.id,
      source: 'seed',
    },
  });

  await prisma.enrollment.upsert({
    where: {
      learnerId_courseId: { learnerId: riya.id, courseId: course.id },
    },
    update: {},
    create: {
      learnerId: riya.id,
      courseId: course.id,
      source: 'manual',
      status: 'active',
    },
  });

  await prisma.exploreSection.upsert({
    where: { slug: 'computer-courses' },
    update: {},
    create: {
      slug: 'computer-courses',
      title: 'Computer Courses',
      description: 'Learn practical computer skills',
      category: ExploreCategory.learn,
      targetKind: 'catalog',
      targetRef: 'course,paid',
      pricingFilter: 'all',
      sortOrder: 0,
      featured: true,
      homeVisible: true,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      iconKey: 'computer',
      themeKey: 'teal',
    },
  });

  await prisma.exploreSection.upsert({
    where: { slug: 'competitive-exams' },
    update: {},
    create: {
      slug: 'competitive-exams',
      title: 'Competitive Exams',
      description: 'Practice tests and exam prep',
      category: ExploreCategory.prepare,
      targetKind: 'catalog',
      targetRef: 'exam',
      sortOrder: 1,
      featured: true,
      homeVisible: true,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.banner.upsert({
    where: { id: 'seed-banner-welcome' },
    update: {},
    create: {
      id: 'seed-banner-welcome',
      campaignName: 'Welcome 2026',
      title: 'Start learning with REDI',
      subtitle: 'Courses, tests, and live classes',
      ctaLabel: 'Explore',
      placement: 'hero',
      priority: 10,
      targetKind: 'section',
      targetRef: 'computer-courses',
      altText: 'Students learning at REDI',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: {
      learnerId_courseId: { learnerId: riya.id, courseId: course.id },
    },
  });

  const semester1 = await prisma.semesterDefinition.upsert({
    where: { courseId_index: { courseId: course.id, index: 1 } },
    update: {},
    create: {
      courseId: course.id,
      index: 1,
      title: 'Semester 1 — Foundations',
      description: 'Basics and first project',
      requiresManualReview: true,
      unlockRule: 'admin_approval',
    },
  });

  await prisma.semesterDefinition.upsert({
    where: { courseId_index: { courseId: course.id, index: 2 } },
    update: {},
    create: {
      courseId: course.id,
      index: 2,
      title: 'Semester 2 — Advanced',
      description: 'Unlocked after Semester 1 approval',
      requiresManualReview: true,
      unlockRule: 'admin_approval',
    },
  });

  let project = await prisma.project.findFirst({
    where: { courseId: course.id, title: 'Tally company setup project' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        courseId: course.id,
        semesterId: semester1.id,
        title: 'Tally company setup project',
        instructions: 'Create a demo company and export the report.',
        lifecycle: ContentLifecycle.published,
      },
    });
  }

  let q1 = await prisma.question.findFirst({
    where: { prompt: 'What is GST?' },
  });
  if (!q1) {
    q1 = await prisma.question.create({
      data: {
        prompt: 'What is GST?',
        type: 'single_choice',
        status: 'approved',
        marks: 1,
        subject: 'Taxation',
        options: {
          create: [
            { label: 'Goods and Services Tax', isCorrect: true, sortOrder: 0 },
            { label: 'General Sales Tariff', isCorrect: false, sortOrder: 1 },
            { label: 'Government Service Token', isCorrect: false, sortOrder: 2 },
            { label: 'Gross Stock Total', isCorrect: false, sortOrder: 3 },
          ],
        },
      },
    });
  }

  let q2 = await prisma.question.findFirst({
    where: { prompt: 'Tally Prime is primarily used for?' },
  });
  if (!q2) {
    q2 = await prisma.question.create({
      data: {
        prompt: 'Tally Prime is primarily used for?',
        type: 'single_choice',
        status: 'approved',
        marks: 1,
        subject: 'Accounting',
        options: {
          create: [
            { label: 'Accounting and inventory', isCorrect: true, sortOrder: 0 },
            { label: 'Video editing', isCorrect: false, sortOrder: 1 },
            { label: '3D modelling', isCorrect: false, sortOrder: 2 },
            { label: 'Email marketing', isCorrect: false, sortOrder: 3 },
          ],
        },
      },
    });
  }

  let test = await prisma.test.findFirst({
    where: { title: 'Tally Basics Formal Test' },
  });
  if (!test) {
    test = await prisma.test.create({
      data: {
        title: 'Tally Basics Formal Test',
        mode: 'formal',
        courseId: course.id,
        semesterId: semester1.id,
        durationMinutes: 20,
        questionCount: 2,
        maxScore: 2,
        passThreshold: 50,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        resultPolicy: 'after_manual_publish',
        questions: {
          create: [
            { questionId: q1.id, sortOrder: 0, marks: 1 },
            { questionId: q2.id, sortOrder: 1, marks: 1 },
          ],
        },
      },
    });
  }

  console.log('Seeded REDI admin:', admin.email, '(password: admin123)');
  console.log('Enrollment ID (Riya):', enrollment.id);
  console.log('Semester 1 ID:', semester1.id);
  console.log('Project ID:', project.id);
  console.log('Published test ID:', test.id);

  const learnerPasswordHash = await bcrypt.hash('learner123', 10);
  await prisma.learnerCredential.upsert({
    where: { learnerId: riya.id },
    update: { passwordHash: learnerPasswordHash },
    create: { learnerId: riya.id, passwordHash: learnerPasswordHash },
  });

  const arjun = await prisma.learner.findUniqueOrThrow({
    where: { email: 'arjun@learner.local' },
  });
  await prisma.learnerCredential.upsert({
    where: { learnerId: arjun.id },
    update: { passwordHash: learnerPasswordHash },
    create: { learnerId: arjun.id, passwordHash: learnerPasswordHash },
  });

  const lesson = await prisma.lesson.findFirstOrThrow({
    where: { courseId: course.id },
    orderBy: { sortOrder: 'asc' },
  });

  let pdfResource = await prisma.resource.findFirst({
    where: { title: 'Tally Getting Started Notes (PDF)' },
  });
  if (!pdfResource) {
    pdfResource = await prisma.resource.create({
      data: {
        title: 'Tally Getting Started Notes (PDF)',
        kind: 'pdf',
        mimeType: 'application/pdf',
        byteSize: 245760,
        course: { connect: { id: course.id } },
        lesson: { connect: { id: lesson.id } },
        downloadable: true,
        previewAllowed: false,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        mediaAsset: {
          create: {
            storageKey: 'seed/tally-getting-started.pdf.enc',
            mimeType: 'application/pdf',
            byteSize: 245760,
            checksumSha256:
              'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
            encryptionAlgo: 'aes-256-gcm',
            packagingFormat: 'encrypted_pdf',
            lifecycle: ContentLifecycle.published,
          },
        },
      },
    });
  }

  let videoResource = await prisma.resource.findFirst({
    where: { title: 'Tally Getting Started Video' },
  });
  if (!videoResource) {
    videoResource = await prisma.resource.create({
      data: {
        title: 'Tally Getting Started Video',
        kind: 'video',
        mimeType: 'application/dash+xml',
        course: { connect: { id: course.id } },
        lesson: { connect: { id: lesson.id } },
        downloadable: true,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        mediaAsset: {
          create: {
            storageKey: 'seed/tally-getting-started/manifest.mpd',
            mimeType: 'application/dash+xml',
            drmScheme: 'none',
            packagingFormat: 'dash_cenc',
            lifecycle: ContentLifecycle.published,
            offlinePeriodSeconds: 60 * 60 * 24 * 7,
          },
        },
      },
    });
  }

  const existingEntitlement = await prisma.entitlement.findFirst({
    where: {
      learnerId: riya.id,
      courseId: course.id,
      source: 'enrollment',
    },
  });
  if (!existingEntitlement) {
    await prisma.entitlement.create({
      data: {
        learnerId: riya.id,
        courseId: course.id,
        scopeKind: 'course',
        scopeRef: course.id,
        source: 'enrollment',
        state: 'active',
        canDownload: true,
        canPreview: true,
      },
    });
  }

  let admitTemplate = await prisma.documentTemplate.findFirst({
    where: { key: 'redi-admit-card' },
    orderBy: { version: 'desc' },
  });
  if (!admitTemplate) {
    admitTemplate = await prisma.documentTemplate.create({
      data: {
        key: 'redi-admit-card',
        version: 1,
        title: 'REDI Admit Card',
        documentType: 'admit_card',
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
    });
  }

  let certTemplate = await prisma.documentTemplate.findFirst({
    where: { key: 'redi-certificate' },
    orderBy: { version: 'desc' },
  });
  if (!certTemplate) {
    certTemplate = await prisma.documentTemplate.create({
      data: {
        key: 'redi-certificate',
        version: 1,
        title: 'REDI Course Certificate',
        documentType: 'certificate',
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
      },
    });
  }

  const existingAdmit = await prisma.issuedDocument.findFirst({
    where: { learnerId: riya.id, documentType: 'admit_card', serial: 'AC-SEED-001' },
  });
  if (!existingAdmit) {
    const admitResource = await prisma.resource.create({
      data: {
        title: 'Admit Card AC-SEED-001',
        kind: 'pdf',
        mimeType: 'application/pdf',
        course: { connect: { id: course.id } },
        downloadable: true,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        mediaAsset: {
          create: {
            storageKey: 'seed/documents/AC-SEED-001.pdf.enc',
            mimeType: 'application/pdf',
            encryptionAlgo: 'aes-256-gcm',
            packagingFormat: 'encrypted_pdf',
            lifecycle: ContentLifecycle.published,
          },
        },
      },
    });
    await prisma.issuedDocument.create({
      data: {
        learnerId: riya.id,
        documentType: 'admit_card',
        status: 'issued',
        serial: 'AC-SEED-001',
        title: 'Tally Formal Test Admit Card',
        courseId: course.id,
        templateId: admitTemplate.id,
        resourceId: admitResource.id,
        issuedAt: new Date(),
        snapshotJson: JSON.stringify({
          exam: 'Tally Basics Formal Test',
          venue: 'REDI Main Center',
          note: 'Seed document for API testing',
        }),
        issuedByAdminId: admin.id,
      },
    });
  }

  console.log('Learner login: riya@learner.local / learner123');
  console.log('PDF resource ID:', pdfResource.id);
  console.log('Video resource ID:', videoResource.id);
  console.log('Roles, permissions, learner protected-download sample data ready');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
