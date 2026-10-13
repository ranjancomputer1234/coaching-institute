// End-to-end smoke test for every learner and admin route.
// Usage: API_URL=http://localhost:3333/api node scripts/smoke.mjs
// Writes data with a unique suffix, so run it against local or staging only.

const BASE = (process.env.API_URL ?? 'http://localhost:3333/api').replace(/\/$/, '');
const ADMIN = {
  email: process.env.SMOKE_ADMIN_EMAIL ?? 'admin@institute.local',
  password: process.env.SMOKE_ADMIN_PASSWORD ?? 'admin123',
};
const LEARNER = {
  email: process.env.SMOKE_LEARNER_EMAIL ?? 'riya@learner.local',
  password: process.env.SMOKE_LEARNER_PASSWORD ?? 'learner123',
};
const run = Date.now().toString(36);
const results = [];

async function call(method, path, { token, body, expect = [200, 201] } = {}) {
  const expected = Array.isArray(expect) ? expect : [expect];
  let status = 0;
  let data = null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    status = res.status;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
  } catch (err) {
    data = { error: String(err) };
  }
  const ok = expected.includes(status);
  results.push({ ok, method, path, status, expected, data: ok ? undefined : data });
  return data;
}

function check(name, condition, detail) {
  results.push({
    ok: Boolean(condition),
    method: 'CHECK',
    path: name,
    status: condition ? 'ok' : 'fail',
    expected: ['ok'],
    data: condition ? undefined : detail,
  });
}

async function main() {
  // —— Public / learner auth ——
  const health = await call('GET', '/health');
  check('health reports database ok', health?.database === 'ok', health);
  await call('GET', '/crypto/offline-verification');
  const login = await call('POST', '/auth/login', { body: LEARNER });
  const lt = login?.accessToken;
  check('learner login returns token', lt, login);

  const regEmail = `smoke.${run}@learner.local`;
  const reg = await call('POST', '/auth/register', {
    body: { firstName: 'Smoke', lastName: 'Learner', email: regEmail, password: 'smoke123', city: 'Patna' },
  });
  await call('POST', '/auth/register', {
    body: { firstName: 'Smoke', lastName: 'Learner', email: regEmail, password: 'smoke123' },
    expect: 400,
  });
  await call('POST', '/auth/register', { body: { email: 'bad' }, expect: 400 });
  await call('POST', '/auth/login', { body: { ...LEARNER, password: 'wrong-pass' }, expect: 401 });
  await call('GET', '/me', { expect: 401 });
  await call('GET', '/me', { token: lt });
  await call('PATCH', '/me', { token: lt, body: { appVersion: `smoke-${run}` } });
  await call('PATCH', '/me', { token: lt, body: { notAField: 1 }, expect: 400 });
  await call('POST', '/auth/logout');

  // —— Catalogue ——
  const home = await call('GET', '/home');
  await call('GET', '/home/me', { token: lt });
  await call('GET', '/categories');
  const search = await call('GET', '/search?q=Tally');
  const empty = await call('GET', '/search?q=');
  check('empty search returns empty lists', empty?.courses?.length === 0, empty);
  const tally =
    home?.featuredCourses?.find((c) => c.slug === 'tally-prime-basics') ??
    search?.courses?.find((c) => c.slug === 'tally-prime-basics');
  check('seed course is discoverable', tally, { home, search });
  const courseId = tally?.id;

  await call('GET', `/courses/${courseId}`);
  const access = await call('GET', `/courses/${courseId}/access`, { token: lt });
  check('free course access granted', access?.access?.granted === true, access?.access);
  await call('POST', `/courses/${courseId}/enroll`, { token: lt });
  const lessons = await call('GET', `/courses/${courseId}/lessons`);
  const lessonId = lessons?.[0]?.id;
  const lesson = await call('GET', `/lessons/${lessonId}`);
  check('lesson hides mediaUrl', lesson && !('mediaUrl' in lesson), lesson);
  await call('POST', `/lessons/${lessonId}/progress`, { token: lt, body: { progressPct: 40, positionSeconds: 90 } });
  await call('POST', `/lessons/${lessonId}/progress`, { token: lt, body: { progressPct: 140 }, expect: 400 });
  await call('POST', `/lessons/${lessonId}/complete`, { token: lt });
  await call('GET', '/courses/does-not-exist', { expect: 404 });
  await call('GET', '/lessons/does-not-exist', { expect: 404 });
  const enrollments = await call('GET', '/me/enrollments', { token: lt });
  await call('GET', '/me/entitlements', { token: lt });

  // —— Documents (learner) ——
  const docs = await call('GET', '/me/documents', { token: lt });
  const docId = docs?.[0]?.id;
  check('learner has a seeded document', docId, docs);
  const doc = await call('GET', `/me/documents/${docId}`, { token: lt });
  check('document detail forbids sharing', doc?.shareForbidden === true, doc);
  const verify = await call('GET', `/documents/verify/${doc?.verificationToken}`);
  check('document verifies', verify?.valid === true, verify);
  check('verification hides contact data', verify && !('email' in verify) && !('phone' in verify), verify);
  const bogus = await call('GET', '/documents/verify/not-a-token');
  check('unknown token is invalid', bogus?.valid === false, bogus);
  await call('GET', '/me/documents/not-mine', { token: lt, expect: 404 });

  // —— Admin auth ——
  const adminLogin = await call('POST', '/admin/auth/login', { body: ADMIN });
  const at = adminLogin?.accessToken;
  check('admin login returns token', at, adminLogin);
  await call('POST', '/admin/auth/login', { body: { ...ADMIN, password: 'wrong-pass' }, expect: 401 });
  await call('GET', '/admin/auth/me', { token: at });
  await call('GET', '/admin/auth/me', { token: lt, expect: 401 });
  await call('GET', '/me', { token: at, expect: 401 });
  await call('GET', '/admin/dashboard', { expect: 401 });
  await call('GET', '/admin/dashboard', { token: at });
  await call('POST', '/admin/auth/logout', { token: at });

  // —— Learners ——
  const learners = await call('GET', '/admin/learners', { token: at });
  await call('GET', '/admin/learners?q=riya', { token: at });
  const riya = learners?.find?.((l) => l.email === LEARNER.email) ?? learners?.items?.find?.((l) => l.email === LEARNER.email);
  const arjun = learners?.find?.((l) => l.email === 'arjun@learner.local') ?? learners?.items?.find?.((l) => l.email === 'arjun@learner.local');
  check('admin learner list includes seed learners', riya && arjun, learners);
  const newLearner = await call('POST', '/admin/learners', {
    token: at,
    body: { firstName: 'Admin', lastName: `Made${run}`, email: `admin.made.${run}@learner.local`, city: 'Gaya' },
  });
  await call('GET', `/admin/learners/${newLearner?.id}`, { token: at });
  await call('PATCH', `/admin/learners/${newLearner?.id}`, { token: at, body: { city: 'Ranchi', internalNotes: 'smoke' } });
  await call('POST', `/admin/learners/${newLearner?.id}/suspend`, { token: at, body: { reason: 'smoke test' } });
  await call('POST', `/admin/learners/${newLearner?.id}/reactivate`, { token: at, body: { reason: 'smoke test' } });
  await call('POST', `/admin/learners/${newLearner?.id}/suspend`, { token: at, body: { reason: 'x' }, expect: 400 });

  // A suspended learner cannot sign in.
  if (reg?.learner?.id) {
    await call('POST', `/admin/learners/${reg.learner.id}/suspend`, { token: at, body: { reason: 'smoke suspend' } });
    await call('POST', '/auth/login', { body: { email: regEmail, password: 'smoke123' }, expect: 401 });
  }

  // —— Batches ——
  await call('GET', '/admin/batches', { token: at });
  await call('GET', '/batches', { token: at });
  const batch = await call('POST', '/admin/batches', { token: at, body: { name: `Smoke batch ${run}`, subject: 'Tally', startDate: '2026-11-01' } });
  await call('GET', `/admin/batches/${batch?.id}`, { token: at });
  await call('PATCH', `/admin/batches/${batch?.id}`, { token: at, body: { subject: 'GST' } });
  await call('DELETE', `/admin/batches/${batch?.id}`, { token: at });

  // —— Courses ——
  await call('GET', '/admin/courses', { token: at });
  const course = await call('POST', '/admin/courses', {
    token: at,
    body: { slug: `smoke-${run}`, title: `Smoke Course ${run}`, commercialMode: 'paid', featured: false, estimatedMinutes: 60 },
  });
  await call('GET', `/admin/courses/${course?.id}`, { token: at });
  await call('PATCH', `/admin/courses/${course?.id}`, { token: at, body: { summary: 'Smoke summary' } });
  const newLesson = await call('POST', `/admin/courses/${course?.id}/lessons`, {
    token: at,
    body: { title: 'Smoke lesson', durationMinutes: 5, contentType: 'video', isPreview: false },
  });
  await call('POST', `/admin/courses/${course?.id}/publish`, { token: at });
  await call('POST', `/admin/courses/${course?.id}/unpublish`, { token: at });
  await call('POST', `/admin/courses/${course?.id}/publish`, { token: at });
  await call('POST', '/admin/courses', { token: at, body: { slug: `smoke-${run}`, title: 'Duplicate' }, expect: 409 });

  // Paid course: Arjun is denied until granted.
  const arjunLogin = await call('POST', '/auth/login', { body: { email: 'arjun@learner.local', password: LEARNER.password } });
  const arjunToken = arjunLogin?.accessToken;
  const denied = await call('GET', `/courses/${course?.id}/access`, { token: arjunToken });
  check('paid course denied without entitlement', denied?.access?.granted === false, denied?.access);
  await call('POST', `/courses/${course?.id}/enroll`, { token: arjunToken, expect: 403 });

  // —— Entitlements ——
  await call('GET', '/admin/entitlements', { token: at });
  const grant = await call('POST', '/admin/entitlements/grant', {
    token: at,
    body: { learnerId: arjun?.id, courseId: course?.id, source: 'manual', grantReason: 'smoke grant' },
  });
  const granted = await call('GET', `/courses/${course?.id}/access`, { token: arjunToken });
  check('entitlement grants course access', granted?.access?.granted === true, granted?.access);
  await call('POST', `/courses/${course?.id}/enroll`, { token: arjunToken });

  // —— Explore ——
  const sections = await call('GET', '/admin/explore-sections', { token: at });
  const section = await call('POST', '/admin/explore-sections', {
    token: at,
    body: { slug: `smoke-${run}`, title: 'Smoke section', category: 'learn', targetKind: 'course', targetRef: courseId },
  });
  await call('GET', `/admin/explore-sections/${section?.id}`, { token: at });
  await call('PATCH', `/admin/explore-sections/${section?.id}`, { token: at, body: { badge: 'New' } });
  await call('POST', `/admin/explore-sections/${section?.id}/publish`, { token: at });
  const ids = [...(Array.isArray(sections) ? sections.map((s) => s.id) : []), section?.id].filter(Boolean);
  await call('POST', '/admin/explore-sections/reorder', { token: at, body: { orderedIds: ids.reverse() } });

  // —— Banners ——
  await call('GET', '/admin/banners', { token: at });
  const banner = await call('POST', '/admin/banners', {
    token: at,
    body: { campaignName: `Smoke ${run}`, title: 'Smoke banner', placement: 'hero', targetKind: 'course', targetRef: courseId },
  });
  await call('GET', `/admin/banners/${banner?.id}`, { token: at });
  await call('PATCH', `/admin/banners/${banner?.id}`, { token: at, body: { subtitle: 'Updated' } });
  await call('POST', `/admin/banners/${banner?.id}/publish`, { token: at });
  await call('POST', `/admin/banners/${banner?.id}/pause`, { token: at });
  await call('POST', '/admin/banners', {
    token: at,
    body: { campaignName: 'Bad', title: 'Bad target', targetKind: 'url', targetRef: 'javascript:alert(1)' },
    expect: 400,
  });
  await call('PATCH', `/admin/banners/${banner?.id}`, {
    token: at,
    body: { targetKind: 'external', targetRef: ' data:text/html,hi' },
    expect: 400,
  });

  // —— Questions, tests, attempts, results ——
  await call('GET', '/admin/questions', { token: at });
  const q = await call('POST', '/admin/questions', {
    token: at,
    body: {
      prompt: `Smoke question ${run}?`,
      type: 'single_choice',
      marks: 2,
      negativeMarks: 0.5,
      options: [
        { label: 'Right', isCorrect: true },
        { label: 'Wrong', isCorrect: false },
      ],
    },
  });
  await call('POST', '/admin/questions', {
    token: at,
    body: { prompt: 'No correct answer?', options: [{ label: 'A', isCorrect: false }, { label: 'B', isCorrect: false }] },
    expect: 400,
  });
  await call('GET', `/admin/questions/${q?.id}`, { token: at });
  await call('PATCH', `/admin/questions/${q?.id}`, { token: at, body: { topic: 'smoke' } });
  await call('POST', `/admin/questions/${q?.id}/approve`, { token: at, body: {} });
  const q2 = await call('POST', '/admin/questions', {
    token: at,
    body: { prompt: `Retire me ${run}?`, options: [{ label: 'A', isCorrect: true }, { label: 'B', isCorrect: false }] },
  });
  await call('POST', `/admin/questions/${q2?.id}/retire`, { token: at, body: { reason: 'smoke retire' } });

  await call('GET', '/admin/tests', { token: at });
  const test = await call('POST', '/admin/tests', {
    token: at,
    body: { title: `Smoke test ${run}`, mode: 'formal', courseId, durationMinutes: 30, passThreshold: 50, negativeMarking: true },
  });
  await call('GET', `/admin/tests/${test?.id}`, { token: at });
  await call('PATCH', `/admin/tests/${test?.id}`, { token: at, body: { instructions: 'Answer all' } });
  await call('POST', `/admin/tests/${test?.id}/publish`, { token: at, expect: 400 });
  await call('POST', `/admin/tests/${test?.id}/questions`, { token: at, body: { questionIds: [q2?.id] }, expect: 400 });
  await call('POST', `/admin/tests/${test?.id}/questions`, { token: at, body: { questionIds: [q?.id] } });
  await call('POST', `/admin/tests/${test?.id}/publish`, { token: at });

  await call('GET', '/admin/attempts', { token: at });
  const attempt = await call('POST', '/admin/attempts', { token: at, body: { testId: test?.id, learnerId: riya?.id } });
  await call('GET', `/admin/attempts/${attempt?.id}`, { token: at });
  const fullQ = await call('GET', `/admin/questions/${q?.id}`, { token: at });
  const right = fullQ?.options?.find((o) => o.isCorrect);
  await call('POST', `/admin/attempts/${attempt?.id}/answers/${q?.id}`, { token: at, body: { selectedOptionId: right?.id } });
  const submitted = await call('POST', `/admin/attempts/${attempt?.id}/submit`, { token: at });
  await call('POST', `/admin/attempts/${attempt?.id}/submit`, { token: at });
  await call('POST', `/admin/attempts/${attempt?.id}/answers/${q?.id}`, {
    token: at,
    body: { selectedOptionId: right?.id },
    expect: 400,
  });
  const wrong = fullQ?.options?.find((o) => !o.isCorrect);
  const attempt2 = await call('POST', '/admin/attempts', { token: at, body: { testId: test?.id, learnerId: arjun?.id } });
  await call('POST', `/admin/attempts/${attempt2?.id}/answers/${q?.id}`, { token: at, body: { selectedOptionId: wrong?.id } });
  await call('POST', `/admin/attempts/${attempt2?.id}/submit`, { token: at });

  const results_ = await call('GET', '/admin/results', { token: at });
  await call('GET', '/admin/results?published=false', { token: at });
  const resultId =
    submitted?.result?.id ??
    submitted?.id ??
    (Array.isArray(results_) ? results_.find((r) => r.attemptId === attempt?.id)?.id : undefined);
  const resultRow = Array.isArray(results_) ? results_.find((r) => r.attemptId === attempt?.id) : undefined;
  check('submitted attempt is scored', resultRow?.rawScore === 2, { submitted, resultRow });
  if (resultRow?.id) {
    await call('GET', `/admin/results/${resultRow.id}`, { token: at });
    await call('POST', `/admin/results/${resultRow.id}/publish`, { token: at, body: { reason: 'smoke publish' } });
  } else {
    check('result id resolved', false, { resultId, results_ });
  }
  await call('POST', `/admin/results/by-test/${test?.id}/publish`, { token: at, body: { reason: 'smoke bulk publish' } });
  await call('POST', `/admin/results/by-test/${test?.id}/publish`, { token: at, body: {}, expect: 400 });

  // —— Projects and semesters ——
  await call('GET', '/admin/projects', { token: at });
  await call('GET', '/admin/semesters', { token: at });
  const semester = await call('POST', '/admin/semesters', {
    token: at,
    body: { courseId: course?.id, title: 'Smoke Semester 1', index: 1 },
  });
  await call('POST', '/admin/semesters', { token: at, body: { courseId: course?.id, title: 'Smoke Semester 2', index: 2 } });
  await call('GET', `/admin/semesters?courseId=${course?.id}`, { token: at });

  const project = await call('POST', '/admin/projects', {
    token: at,
    body: { courseId: course?.id, semesterId: semester?.id, title: `Smoke project ${run}`, instructions: 'Build a ledger' },
  });
  await call('GET', `/admin/projects/${project?.id}`, { token: at });
  await call('POST', `/admin/projects/${project?.id}/submissions`, { token: at, body: { learnerId: arjun?.id }, expect: 400 });
  const sub1 = await call('POST', `/admin/projects/${project?.id}/submissions`, {
    token: at,
    body: { learnerId: arjun?.id, textBody: 'First draft' },
  });
  await call('POST', `/admin/projects/submissions/${sub1?.id}/request-changes`, {
    token: at,
    body: { learnerFeedback: 'Add GST entries' },
  });
  await call('POST', `/admin/projects/submissions/${sub1?.id}/accept`, {
    token: at,
    body: { learnerFeedback: 'Too late' },
    expect: 400,
  });
  const sub2 = await call('POST', `/admin/projects/${project?.id}/submissions`, {
    token: at,
    body: { learnerId: arjun?.id, textBody: 'Second draft' },
  });
  await call('GET', '/admin/projects/submissions', { token: at });
  await call('POST', `/admin/projects/submissions/${sub2?.id}/accept`, { token: at, body: { learnerFeedback: 'Great work' } });

  const arjunEnrollments = await call('GET', '/me/enrollments', { token: arjunToken });
  const arjunEnrollment = arjunEnrollments?.find?.((e) => e.courseId === course?.id);
  const review = await call('POST', '/admin/semester-reviews/submit', {
    token: at,
    body: { enrollmentId: arjunEnrollment?.id, semesterId: semester?.id },
  });
  await call('GET', '/admin/semester-reviews', { token: at });
  await call('POST', `/admin/semester-reviews/${review?.id}/request-changes`, { token: at, body: {}, expect: 400 });
  await call('POST', `/admin/semester-reviews/${review?.id}/approve`, { token: at, body: { learnerFeedback: 'Approved' } });
  await call('POST', `/admin/semester-reviews/${review?.id}/approve`, { token: at, body: {} });
  await call('POST', `/admin/semester-reviews/${review?.id}/request-changes`, {
    token: at,
    body: { learnerFeedback: 'too late' },
    expect: 400,
  });
  const riyaEnrollment = enrollments?.find?.((e) => e.courseId === courseId);
  await call('POST', '/admin/semester-reviews/submit', {
    token: at,
    body: { enrollmentId: riyaEnrollment?.id, semesterId: semester?.id },
    expect: 400,
  });

  // —— Resources, video and protected downloads ——
  const resources = await call('GET', '/admin/resources', { token: at });
  const pdf = resources?.find?.((r) => r.kind === 'pdf' && r.title.includes('Notes'));
  const seedVideo = resources?.find?.((r) => r.title === 'Tally Getting Started Video');
  check('seed pdf and video resources exist', pdf && seedVideo, resources);

  const device = { deviceId: `smoke-device-${run}`, installationId: `inst-${run}` };
  const pdfAuth = await call('POST', `/resources/${pdf?.id}/download-authorization`, { token: lt, body: device });
  check('pdf authorization has signed grant', pdfAuth?.offlineAuthorization?.signature, pdfAuth);
  check('pdf delivery forbids export', pdfAuth?.delivery?.exportForbidden === true, pdfAuth?.delivery);
  const pdfToken = pdfAuth?.delivery?.url ? new URL(pdfAuth.delivery.url).searchParams.get('token') : null;
  const delivered = await call('GET', `/protected/delivery/${pdf?.id}?token=${pdfToken}`);
  check('delivery returns storage metadata', delivered?.storageKey, delivered);
  await call('GET', `/protected/delivery/${pdf?.id}?token=bogus`, { expect: 403 });
  await call('GET', `/protected/delivery/${seedVideo?.id}?token=${pdfToken}`, { expect: 403 });
  await call('POST', `/resources/${pdf?.id}/download-authorization`, { body: device, expect: 401 });
  await call('POST', '/resources/does-not-exist/download-authorization', { token: lt, body: device, expect: 404 });

  const videoAuth = await call('POST', `/resources/${seedVideo?.id}/download-authorization`, { token: lt, body: device });
  check(
    'unconfigured video reports DRM provider required',
    videoAuth?.drm?.status === 'provider_configuration_required',
    videoAuth?.drm,
  );

  const drmVideo = await call('POST', '/admin/resources', {
    token: at,
    body: {
      title: `Smoke DRM video ${run}`,
      kind: 'video',
      mimeType: 'application/dash+xml',
      byteSize: 10485760,
      courseId: course?.id,
      lessonId: newLesson?.id,
      storageKey: `smoke/${run}/manifest.mpd`,
      checksumSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      packagingFormat: 'dash_cenc',
      drmScheme: 'widevine',
      drmContentId: `content-${run}`,
      licenseServiceUrl: 'https://license.example.com/widevine',
      offlinePeriodSeconds: 86400,
      downloadable: true,
    },
  });
  await call('POST', '/admin/resources', { token: at, body: { title: 'Bad kind', kind: 'movie', mimeType: 'x' }, expect: 400 });
  await call('POST', `/resources/${drmVideo?.id}/download-authorization`, { token: lt, body: device, expect: 403 });
  const drmAuth = await call('POST', `/resources/${drmVideo?.id}/download-authorization`, { token: arjunToken, body: device });
  check('configured DRM video is ready', drmAuth?.drm?.status === 'ready' && drmAuth?.drm?.scheme === 'widevine', drmAuth?.drm);

  // —— Documents (admin) ——
  await call('GET', '/admin/document-templates', { token: at });
  const template = await call('POST', '/admin/document-templates', {
    token: at,
    body: { key: `smoke-cert-${run}`, title: 'Smoke certificate', documentType: 'certificate' },
  });
  await call('GET', '/admin/documents', { token: at });
  await call('GET', '/admin/documents?status=issued', { token: at });
  const issued = await call('POST', '/admin/documents/issue', {
    token: at,
    body: {
      learnerId: arjun?.id,
      documentType: 'certificate',
      title: `Smoke certificate ${run}`,
      courseId: course?.id,
      templateId: template?.id,
      serial: `CERT-${run}`,
      storageKey: `smoke/${run}/cert.pdf.enc`,
      snapshot: { grade: 'A' },
    },
  });
  const arjunDocs = await call('GET', '/me/documents', { token: arjunToken });
  check('issued certificate visible to learner', arjunDocs?.some?.((d) => d.id === issued?.id), arjunDocs);
  const certResource = issued?.resourceId;
  if (certResource) {
    await call('POST', `/resources/${certResource}/download-authorization`, { token: arjunToken, body: device });
  }
  await call('POST', `/admin/documents/${issued?.id}/revoke`, { token: at, body: { reason: 'x' }, expect: 400 });
  await call('POST', `/admin/documents/${issued?.id}/revoke`, { token: at, body: { reason: 'smoke revoke' } });
  const revokedVerify = await call('GET', `/documents/verify/${(await call('GET', `/me/documents/${issued?.id}`, { token: arjunToken }))?.verificationToken}`);
  check('revoked certificate no longer verifies', revokedVerify?.valid === false, revokedVerify);
  if (certResource) {
    await call('POST', `/resources/${certResource}/download-authorization`, { token: arjunToken, body: device, expect: 403 });
  }

  await call('POST', `/admin/entitlements/${grant?.id}/revoke`, { token: at, body: { reason: 'smoke revoke' } });

  // —— Staff and permissions ——
  await call('GET', '/admin/staff', { token: at });
  const roles = await call('GET', '/admin/roles', { token: at });
  const limitedRole = roles?.find?.((r) => r.key !== 'super_admin');
  const staffEmail = `smoke.staff.${run}@institute.local`;
  const staff = await call('POST', '/admin/staff', {
    token: at,
    body: { email: staffEmail, name: 'Smoke Staff', password: 'smoke123', roleKey: limitedRole?.key },
  });
  const staffLogin = await call('POST', '/admin/auth/login', { body: { email: staffEmail, password: 'smoke123' } });
  await call('GET', '/admin/staff', { token: staffLogin?.accessToken, expect: 403 });
  await call('PATCH', `/admin/staff/${staff?.id}`, { token: at, body: { isActive: false } });
  await call('POST', '/admin/auth/login', { body: { email: staffEmail, password: 'smoke123' }, expect: 401 });

  await call('GET', '/admin/audit-events', { token: at });

  // —— Platform ——
  await call('GET', '/admin/editorial', { token: at });
  await call('GET', '/admin/editorial?kind=news', { token: at });
  const editorial = await call('POST', '/admin/editorial', { token: at, body: { kind: 'news', title: `Smoke news ${run}`, summary: 's' } });
  await call('POST', `/admin/editorial/${editorial?.id}/publish`, { token: at });

  await call('GET', '/admin/live-classes', { token: at });
  const live = await call('POST', '/admin/live-classes', {
    token: at,
    body: {
      title: `Smoke live ${run}`,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 90000000).toISOString(),
      courseId,
      capacity: 50,
    },
  });
  await call('POST', `/admin/live-classes/${live?.id}/schedule`, { token: at });

  await call('GET', '/admin/notification-templates', { token: at });
  const ntpl = await call('POST', '/admin/notification-templates', {
    token: at,
    body: { key: `smoke-${run}`, title: 'Smoke', body: 'Hello {{name}}', channel: 'push' },
  });
  await call('GET', '/admin/notifications', { token: at });
  const campaign = await call('POST', '/admin/notifications', {
    token: at,
    body: { title: 'Smoke campaign', body: 'Hello', audience: 'everyone', templateId: ntpl?.id },
  });
  await call('POST', `/admin/notifications/${campaign?.id}/send`, { token: at });

  await call('GET', '/admin/products', { token: at });
  const product = await call('POST', '/admin/products', {
    token: at,
    body: { sku: `SMOKE-${run}`, title: 'Smoke product', pricePaise: 49900, courseId: course?.id },
  });
  await call('GET', '/admin/coupons', { token: at });
  await call('POST', '/admin/coupons', { token: at, body: { code: `SMOKE${run}`.toUpperCase(), percentOff: 10 } });
  await call('GET', '/admin/orders', { token: at });
  const order = await call('POST', '/admin/orders', { token: at, body: { learnerId: riya?.id, productId: product?.id } });
  await call('POST', `/admin/orders/${order?.id}/reconcile`, { token: at, body: { externalReference: `pay_${run}` } });
  await call('GET', '/admin/refunds', { token: at });
  const refund = await call('POST', '/admin/refunds', {
    token: at,
    body: { orderId: order?.id, reason: 'smoke refund', amountPaise: 10000 },
  });
  await call('POST', `/admin/refunds/${refund?.id}/approve`, { token: at });

  await call('GET', '/admin/support-cases', { token: at });
  const ticket = await call('POST', '/admin/support-cases', {
    token: at,
    body: { subject: 'Smoke ticket', body: 'Cannot open PDF', learnerId: riya?.id },
  });
  await call('PATCH', `/admin/support-cases/${ticket?.id}`, { token: at, body: { status: 'resolved' } });

  await call('GET', '/admin/settings', { token: at });
  await call('POST', '/admin/settings', { token: at, body: { key: 'smoke.lastRun', value: run } });
  await call('GET', '/admin/reports/summary', { token: at });
}

main()
  .catch((err) => {
    results.push({ ok: false, method: 'SCRIPT', path: 'crashed', status: 'error', expected: [], data: String(err?.stack ?? err) });
  })
  .finally(() => {
    const failed = results.filter((r) => !r.ok);
    for (const r of results) {
      const mark = r.ok ? 'PASS' : 'FAIL';
      console.log(`${mark} ${String(r.status).padEnd(5)} ${r.method.padEnd(6)} ${r.path}`);
      if (!r.ok) {
        console.log(`       expected ${r.expected.join('/')}: ${JSON.stringify(r.data)?.slice(0, 400)}`);
      }
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed against ${BASE}`);
    process.exit(failed.length ? 1 : 0);
  });
