import { PrismaClient, ContentLifecycle, ExploreCategory } from '@prisma/client';
import { LEGAL_PAGE_DEFAULTS } from '../src/modules/platform/legal-pages';
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
    update: {
      imageUrl: 'https://picsum.photos/seed/redi-banner-welcome/1080/432',
      placement: 'hero',
      priority: 10,
      targetKind: 'catalog',
      targetRef: 'course',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
    create: {
      id: 'seed-banner-welcome',
      campaignName: 'Welcome 2026',
      title: 'Start learning with REDI',
      subtitle: 'Courses, tests, and live classes',
      ctaLabel: 'Explore',
      placement: 'hero',
      priority: 10,
      imageUrl: 'https://picsum.photos/seed/redi-banner-welcome/1080/432',
      targetKind: 'catalog',
      targetRef: 'course',
      altText: 'Start learning with REDI',
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

  const legalEffectiveAt = new Date('2026-10-26T00:00:00.000Z');
  for (const page of LEGAL_PAGE_DEFAULTS) {
    const existing = await prisma.legalPage.findFirst({
      where: { slug: page.slug, locale: page.locale },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.legalPage.create({
      data: {
        slug: page.slug,
        locale: page.locale,
        title: page.title,
        summary: page.summary,
        body: page.body,
        version: 1,
        lifecycle: ContentLifecycle.published,
        publishedAt: legalEffectiveAt,
        effectiveAt: legalEffectiveAt,
      },
    });
  }

  const dummyCourseCount = await seedDummyCatalogue();
  await seedLearnerContentApis(batch.id);

  console.log('Learner login: riya@learner.local / learner123');
  console.log('PDF resource ID:', pdfResource.id);
  console.log('Video resource ID:', videoResource.id);
  console.log(`Dummy courses ready: ${dummyCourseCount} (public sample MP4s)`);
  console.log('Roles, permissions, learner protected-download sample data ready');
}

/** Exams, editorial, and live classes for learner app screens (update 031126). */
async function seedLearnerContentApis(batchId: string) {
  const exam = await prisma.exam.upsert({
    where: { id: 'exam-ssc' },
    update: {
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
    create: {
      id: 'exam-ssc',
      title: 'SSC CGL',
      summary: 'Tier 1 practice',
      description: 'Syllabus, guided practice and mock tests',
      commercialMode: 'free',
      iconKey: 'target',
      themeKey: 'purple',
      learnerCount: 2400,
      relatedExamsJson: JSON.stringify(['Banking', 'Railways']),
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const dailyTest = await prisma.test.upsert({
    where: { id: 'test-daily' },
    update: {
      examId: exam.id,
      pricing: 'free',
      mode: 'practice',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
    create: {
      id: 'test-daily',
      title: 'Daily current affairs',
      examId: exam.id,
      mode: 'practice',
      pricing: 'free',
      marking: '+1',
      negativeMarkingLabel: '0',
      questionCount: 10,
      durationMinutes: 15,
      passThreshold: 40,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.test.upsert({
    where: { id: 'test-ssc-mock-1' },
    update: { examId: exam.id, lifecycle: ContentLifecycle.published },
    create: {
      id: 'test-ssc-mock-1',
      title: 'SSC CGL Mock 1',
      examId: exam.id,
      mode: 'formal',
      pricing: 'free',
      marking: '+2',
      negativeMarkingLabel: '-0.5',
      questionCount: 25,
      durationMinutes: 30,
      passThreshold: 40,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const newsNational = await prisma.contentCategory.upsert({
    where: { id: 'news-national' },
    update: { lifecycle: ContentLifecycle.published, publishedAt: new Date() },
    create: {
      id: 'news-national',
      kind: 'news',
      title: 'National',
      summary: 'India and policy',
      pricing: 'free',
      iconKey: 'news',
      sortOrder: 0,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.editorialItem.upsert({
    where: { id: 'news-1' },
    update: {
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      categoryId: newsNational.id,
      featured: true,
    },
    create: {
      id: 'news-1',
      kind: 'news',
      title: 'Cabinet clears the new skilling plan',
      summary: 'A short summary for the card.',
      body: JSON.stringify([
        'First paragraph.',
        'Second paragraph.',
      ]),
      categoryId: newsNational.id,
      category: 'National',
      pricing: 'free',
      featured: true,
      byline: 'RACI News',
      readingMinutes: 3,
      tagsJson: JSON.stringify(['policy', 'jobs']),
      highlightsJson: JSON.stringify(['Point one', 'Point two']),
      imageUrl: 'https://picsum.photos/seed/redi-news-1/800/450',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.editorialItem.upsert({
    where: { id: 'topic-capitals' },
    update: {
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      schema: 'pairs',
    },
    create: {
      id: 'topic-capitals',
      kind: 'awareness',
      title: 'States and Capitals',
      summary: 'Indian states',
      pricing: 'free',
      iconKey: 'book',
      schema: 'pairs',
      summaryChipsJson: JSON.stringify(['28 states', '8 union territories']),
      entriesJson: JSON.stringify([
        {
          id: 'entry-bihar',
          label: 'Bihar',
          value: 'Patna',
          group: 'State',
          iconColor: '#1A237E',
        },
        {
          id: 'entry-jharkhand',
          label: 'Jharkhand',
          value: 'Ranchi',
          group: 'State',
          iconColor: '#004D40',
        },
      ]),
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const factsScience = await prisma.contentCategory.upsert({
    where: { id: 'facts-science' },
    update: { lifecycle: ContentLifecycle.published, publishedAt: new Date() },
    create: {
      id: 'facts-science',
      kind: 'fact',
      title: 'Science',
      summary: 'Short science facts',
      pricing: 'free',
      iconKey: 'bulb',
      sortOrder: 0,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.editorialItem.upsert({
    where: { id: 'fact-1' },
    update: {
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      categoryId: factsScience.id,
      featured: true,
      quizId: dailyTest.id,
    },
    create: {
      id: 'fact-1',
      kind: 'fact',
      title: 'Honey never spoils.',
      summary: 'Honey never spoils.',
      explanation: 'Low water and acid keep it stable.',
      categoryId: factsScience.id,
      pricing: 'free',
      featured: true,
      reactionCount: 18,
      quizId: dailyTest.id,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const intHr = await prisma.contentCategory.upsert({
    where: { id: 'int-hr' },
    update: { lifecycle: ContentLifecycle.published, publishedAt: new Date() },
    create: {
      id: 'int-hr',
      kind: 'interview',
      title: 'HR questions',
      summary: 'Introductions and behaviour',
      pricing: 'free',
      iconKey: 'users',
      sortOrder: 0,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.contentCategory.upsert({
    where: { id: 'int-tech' },
    update: { lifecycle: ContentLifecycle.published, publishedAt: new Date() },
    create: {
      id: 'int-tech',
      kind: 'interview',
      title: 'Technical',
      summary: 'Role and domain questions',
      pricing: 'free',
      iconKey: 'code',
      sortOrder: 1,
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  await prisma.editorialItem.upsert({
    where: { id: 'q-tell-me' },
    update: {
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
      categoryId: intHr.id,
    },
    create: {
      id: 'q-tell-me',
      kind: 'interview',
      title: 'Tell me about yourself.',
      prompt: 'Tell me about yourself.',
      modelAnswer:
        'Present role, one proof point, and why this job.',
      categoryId: intHr.id,
      pricing: 'free',
      lifecycle: ContentLifecycle.published,
      publishedAt: new Date(),
    },
  });

  const starts = new Date();
  starts.setHours(starts.getHours() + 2);
  const ends = new Date(starts.getTime() + 60 * 60 * 1000);

  await prisma.liveClass.upsert({
    where: { id: 'live-tally-1' },
    update: {
      status: 'scheduled',
      startsAt: starts,
      endsAt: ends,
      batchId,
      hostName: 'RACI Faculty',
    },
    create: {
      id: 'live-tally-1',
      title: 'Tally Prime — GST entries',
      batchId,
      startsAt: starts,
      endsAt: ends,
      hostName: 'RACI Faculty',
      status: 'scheduled',
      provider: 'unconfigured',
      recordingStatus: 'not_available',
      viewerCount: 0,
    },
  });

  console.log('Learner content APIs seeded (exams, news, awareness, facts, interview, live)');
}

/** Published sample courses and video lessons for local admin / learner testing. */
async function seedDummyCatalogue() {
  const sample = (file: string) =>
    `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${file}`;

  const courses: Array<{
    slug: string;
    title: string;
    shortTitle: string;
    summary: string;
    description: string;
    commercialMode: 'free' | 'paid';
    featured: boolean;
    estimatedMinutes: number;
    level: string;
    coverImageUrl: string;
    lessons: Array<{
      title: string;
      description: string;
      sortOrder: number;
      durationMinutes: number;
      isPreview?: boolean;
      videoTitle: string;
      mediaUrl: string;
    }>;
  }> = [
    {
      slug: 'ms-excel-beginners',
      title: 'MS Excel for Beginners',
      shortTitle: 'Excel',
      summary: 'Spreadsheets, formulas, and charts for everyday office work.',
      description:
        'Dummy course for local testing. Lesson files are short public sample clips, not real Excel lessons.',
      commercialMode: 'free',
      featured: true,
      estimatedMinutes: 28,
      level: 'beginner',
      coverImageUrl: 'https://picsum.photos/seed/redi-excel/800/450',
      lessons: [
        {
          title: 'What is a spreadsheet',
          description: 'Rows, columns, and your first workbook.',
          sortOrder: 0,
          durationMinutes: 8,
          isPreview: true,
          videoTitle: 'Excel — What is a spreadsheet',
          mediaUrl: sample('ForBiggerBlazes.mp4'),
        },
        {
          title: 'Formulas and functions',
          description: 'SUM, AVERAGE, and a simple IF.',
          sortOrder: 1,
          durationMinutes: 12,
          videoTitle: 'Excel — Formulas and functions',
          mediaUrl: sample('ForBiggerEscapes.mp4'),
        },
        {
          title: 'Charts in ten minutes',
          description: 'Turn a small table into a column chart.',
          sortOrder: 2,
          durationMinutes: 8,
          videoTitle: 'Excel — Charts in ten minutes',
          mediaUrl: sample('ForBiggerFun.mp4'),
        },
      ],
    },
    {
      slug: 'gst-basics',
      title: 'GST Basics for Small Business',
      shortTitle: 'GST',
      summary: 'How GST works and what a small shop needs to file.',
      description:
        'Dummy paid course for local testing. Lesson files are short public sample clips.',
      commercialMode: 'paid',
      featured: true,
      estimatedMinutes: 22,
      level: 'beginner',
      coverImageUrl: 'https://picsum.photos/seed/redi-gst/800/450',
      lessons: [
        {
          title: 'What is GST',
          description: 'Tax on supply of goods and services.',
          sortOrder: 0,
          durationMinutes: 10,
          isPreview: true,
          videoTitle: 'GST — What is GST',
          mediaUrl: sample('ForBiggerJoyrides.mp4'),
        },
        {
          title: 'Filing a simple return',
          description: 'A walkthrough of a basic monthly return.',
          sortOrder: 1,
          durationMinutes: 12,
          videoTitle: 'GST — Filing a simple return',
          mediaUrl: sample('ForBiggerMeltdowns.mp4'),
        },
      ],
    },
    {
      slug: 'spoken-english-starter',
      title: 'Spoken English Starter',
      shortTitle: 'English',
      summary: 'Introductions and everyday conversations for new speakers.',
      description:
        'Dummy free course for local testing. Lesson files are short public sample clips.',
      commercialMode: 'free',
      featured: false,
      estimatedMinutes: 18,
      level: 'beginner',
      coverImageUrl: 'https://picsum.photos/seed/redi-english/800/450',
      lessons: [
        {
          title: 'Introducing yourself',
          description: 'Name, city, and what you do.',
          sortOrder: 0,
          durationMinutes: 8,
          isPreview: true,
          videoTitle: 'English — Introducing yourself',
          mediaUrl: sample('SubaruOutbackOnStreetAndDirt.mp4'),
        },
        {
          title: 'Everyday conversations',
          description: 'Asking for directions and ordering food.',
          sortOrder: 1,
          durationMinutes: 10,
          videoTitle: 'English — Everyday conversations',
          mediaUrl: sample('TearsOfSteel.mp4'),
        },
      ],
    },
  ];

  for (const item of courses) {
    const course = await prisma.course.upsert({
      where: { slug: item.slug },
      update: {},
      create: {
        slug: item.slug,
        title: item.title,
        shortTitle: item.shortTitle,
        summary: item.summary,
        description: item.description,
        commercialMode: item.commercialMode,
        lifecycle: ContentLifecycle.published,
        publishedAt: new Date(),
        featured: item.featured,
        estimatedMinutes: item.estimatedMinutes,
        level: item.level,
        language: 'en',
        coverImageUrl: item.coverImageUrl,
      },
    });

    for (const lesson of item.lessons) {
      let row = await prisma.lesson.findFirst({
        where: { courseId: course.id, title: lesson.title },
      });
      if (!row) {
        row = await prisma.lesson.create({
          data: {
            courseId: course.id,
            title: lesson.title,
            description: lesson.description,
            sortOrder: lesson.sortOrder,
            durationMinutes: lesson.durationMinutes,
            contentType: 'video',
            mediaUrl: lesson.mediaUrl,
            isPreview: lesson.isPreview ?? false,
            lifecycle: ContentLifecycle.published,
          },
        });
      }

      const existingVideo = await prisma.resource.findFirst({
        where: { lessonId: row.id, title: lesson.videoTitle },
      });
      if (!existingVideo) {
        await prisma.resource.create({
          data: {
            title: lesson.videoTitle,
            kind: 'video',
            mimeType: 'video/mp4',
            course: { connect: { id: course.id } },
            lesson: { connect: { id: row.id } },
            downloadable: true,
            previewAllowed: lesson.isPreview ?? false,
            lifecycle: ContentLifecycle.published,
            publishedAt: new Date(),
            mediaAsset: {
              create: {
                storageKey: lesson.mediaUrl,
                mimeType: 'video/mp4',
                packagingFormat: 'mp4',
                drmScheme: 'none',
                lifecycle: ContentLifecycle.published,
              },
            },
          },
        });
      }
    }
  }

  return courses.length;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
