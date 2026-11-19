# REDI full system and endpoint report

Date of this report: 10 November 2026.

This document describes the software that is actually in this repository today: how the two products talk to one API, how each workflow moves data, and every HTTP endpoint the API exposes. Use it to check that the admin panel, the learner app, and the API are doing the same thing.

The learner mobile app (`com.rediapp.learner`) is **not** in this repository. Alignment for that app is checked against the routes the API implements here and against the screen contracts in `docs/update 031126/`. Those handover notes were written on 3 November 2026 and say several learner routes returned 404 on the then-deployed API. **This source tree now implements those routes.** A 404 on production means that host has not been deployed with this code, not that the route is missing from the repo.

Base path for every route below is `/api`. Local default is `http://localhost:3333/api`.

---

## 1. What is in the repo

| Piece | Path | Role |
|---|---|---|
| API | `apps/api` | NestJS + Prisma + PostgreSQL. One process serves staff and learners. |
| Admin | `apps/admin` | Vite + React. Staff control plane. Calls only `/api/admin/...` plus public `/api/legal`. |
| Shared types | `packages/shared-types` | Shared DTO and permission names. Runtime checks live in the API. |
| Learner app | outside this repo | Must call learner routes only. An admin token will not open them, and a learner token will not open `/api/admin/...`. |

There is no separate mobile backend. Publishing in admin writes PostgreSQL. The learner routes read the same rows after lifecycle and access rules.

### Request path

1. `main.ts` sets the global prefix `api`.
2. CORS uses `CORS_ORIGIN`. Native apps are not limited by browser CORS.
3. `ValidationPipe` is global: unknown JSON fields are rejected (`400`), types are transformed, whitelist is on.
4. Prisma errors are mapped by `PrismaExceptionFilter`.
5. Staff routes use `JwtAuthGuard` (`typ` is not `learner`) then `PermissionsGuard`.
6. Learner routes use `LearnerJwtAuthGuard` or `OptionalLearnerJwtAuthGuard`.
7. Successful `POST` responses are HTTP **201** unless a handler sets another code (`PUT /live-classes/:id/reminder` is **204** with an empty body).

### Two tokens

| | Staff | Learner |
|---|---|---|
| Login | `POST /api/admin/auth/login` | `POST /api/auth/login` or `POST /api/auth/register` |
| Header | `Authorization: Bearer <accessToken>` | same header, different token |
| Payload | `{ sub, email }` signed with `JWT_SECRET` | `{ sub, email, typ: "learner" }` signed with `LEARNER_JWT_SECRET` (falls back to `JWT_SECRET`) |
| Default life | `JWT_EXPIRES_IN`, default `7d` | `LEARNER_JWT_EXPIRES_IN`, default `30d` |
| Logout | Admin UI only deletes the token in the browser. It does **not** call `POST /api/admin/auth/logout`. | `POST /api/auth/logout` returns `{ ok: true }` and does not revoke the token. The app must discard it. |

Neither side keeps a server session blocklist. A stolen token works until it expires.

Seed staff (local): `admin@institute.local` / `admin123` (`super_admin`, every permission).

Seed learners (local): `riya@learner.local` / `learner123` (enrolled, entitlement, admit card) and `arjun@learner.local` / `learner123` (active, no seeded entitlement).

### Error shapes

Business errors:

```json
{ "code": "NOT_FOUND", "message": "...", "fieldErrors": {} }
```

Validation errors keep Nest’s default shape (`statusCode`, `message` array, `error`).

| HTTP | Typical `code` | When |
|---|---|---|
| 400 | `EMAIL_IN_USE`, `TEST_UNAVAILABLE`, `TEST_INVALID`, `ATTEMPT_CLOSED`, `ATTEMPT_EXPIRED`, `COURSE_INVALID`, `REQUIREMENTS_INCOMPLETE`, `INVALID_SEMESTER`, `VALIDATION_ERROR` | Bad input or a rule failed |
| 401 | `UNAUTHORIZED` | Missing or bad token, bad password, learner `suspended` / `blocked` / `deleted` |
| 403 | `FORBIDDEN` | Staff token is valid but a permission key is missing |
| 403 | `ACCESS_DENIED` | Learner has no entitlement, or a live class is not joinable / not in audience |
| 403 | `DOCUMENT_REVOKED` | Download of a revoked, superseded, or not-issued document |
| 403 | `DELIVERY_EXPIRED` | Delivery token missing, wrong resource, revoked, or past `expiresAt` |
| 404 | `NOT_FOUND` | Id unknown, or the row is not in a learner-visible state |

### Pagination used by learner lists

`parseCursorTake` always pages **50** items (hard cap 100, but no query parameter changes it). Pass `cursor` as the previous response’s `nextCursor` (the last item’s `id`). Response:

```json
{ "items": [], "nextCursor": null, "total": 0 }
```

`GET /tests`, `GET /interview/questions`, and `GET /live-classes` return a **bare array**, not a page object.

### Access object

Many learner payloads include:

```json
{
  "granted": false,
  "canPreview": false,
  "canDownload": false,
  "reason": "login_required",
  "source": null
}
```

`reason` is `null` when granted, `login_required` for a guest on paid content, `purchase_required` for a signed-in learner without an entitlement (course access maps the internal reason `entitlement_required` to `purchase_required`). `source` is `free`, `free_course`, `enrollment`, an entitlement source, `preview`, or `issued_document`.

Commercial modes on courses and exams: `free`, `paid`, `included`, `invite_only`, `hidden_internal`.

- `free` grants access without a purchase. Course download is allowed for a signed-in learner on a free course (`canDownload: true` from `resolveCourseAccess`). The guest helper `resolveCommercialAccess` sets `canDownload: false` even for free. Signed-in course lists use the stricter service and therefore allow download on free courses.
- `paid`, `included`, and `invite_only` require a signed-in learner plus an active enrollment **or** an active unexpired entitlement for that course.
- `hidden_internal` courses are omitted from learner course lists and course detail. Exams do not use this filter the same way.

Pricing strings on news, facts, awareness, interview categories, and tests are `free` or `paid`. Paid editorial access is **not** checked against entitlements. `resolvePricingAccess` only looks at the string and whether a learner id was passed. A signed-in learner still sees `purchase_required` on paid news and awareness. There is no purchase that flips that flag.

---

## 2. How publishing reaches the app

Admin writes a row, usually as `draft`. A publish action sets `lifecycle = published` (or, for live classes, `status = scheduled` or a Daily.co status). Learner queries almost always require `published`.

```
Staff login
  -> create draft (course, exam, banner, news, question, test, ...)
  -> attach children (lessons, questions, categories)
  -> publish (permission content.publish or the module’s publish key)
  -> PostgreSQL
  -> learner GET returns the row only if lifecycle/status and access rules pass
```

Content lifecycle values: `draft`, `in_review`, `changes_requested`, `approved`, `scheduled`, `published`, `unpublished`, `archived`.

Learner catalogue, exams, news, awareness, facts, and interview read **`published` only**. `unpublished` and `archived` disappear from the app immediately. They are not deleted.

### Critical alignment: lessons stay draft

`POST /api/admin/courses/:id/lessons` creates a lesson with the schema default `lifecycle = draft`. Course publish only checks that the course has **at least one lesson of any state**. It does **not** set those lessons to `published`.

Learner `GET /courses/:id` and `GET /courses/:id/lessons` return lessons only when `lesson.lifecycle = published` and the course is published.

The seed script sets `lifecycle: published` on sample lessons, so seeded courses show lessons. Lessons added from the Courses screen after seeding stay invisible in the app until something else sets them to `published`. **There is no admin endpoint that publishes a single lesson.**

Check: publish a course in admin, add a lesson in the UI, then `GET /api/courses/:id/lessons` with no token. An empty array means this gap is still present.

---

## 3. Staff permissions

The API checks permission **keys**, not role names. `super_admin` has every key in `apps/api/src/common/permissions/permissions.ts`.

Roles seeded: `super_admin`, `operations_admin`, `academic_admin`, `content_editor`, `reviewer_publisher`, `auditor`. The matrix is in `docs/PERMISSION_MATRIX.md`.

Keys that exist in code but are **not required by any current endpoint**: `users.export`, `users.impersonate_safe`, `content.review`, `content.archive`, `results.recompute`, `results.override`, `live.host`, `live.moderate`.

A missing `@RequirePermissions` on a guarded admin route means any logged-in staff member may call it. That is true for `GET /api/admin/legal` only. Dashboard requires a staff token and no extra key. Support, reports, and legal **screens** are visible in the nav without a permission, but their APIs still require `users.read`, `reports.read`, or a staff token.

---

## 4. Data the API stores

PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`). Ids are `cuid()` except a few seed ids (`seed-batch-redi`, `seed-banner-welcome`) and optional category ids matching `^[a-z0-9-]{2,40}$`.

| Area | Models | What they mean |
|---|---|---|
| Staff | `AdminUser`, `Role`, `Permission`, `RolePermission`, `AdminRoleAssignment` | Login and RBAC |
| People | `Learner`, `LearnerCredential`, `Batch`, `BatchMembership` | Learner profile, password hash, batch roster. `Learner.batchId` is the primary batch. Memberships are the many-to-many roster. |
| Catalogue | `Course`, `Lesson`, `LessonProgress`, `Enrollment` | Course tree, watch progress, self-enrol or entitlement enrol |
| Explore / home | `ExploreSection`, `Banner` | Home rails and hero images. Explore tiles do **not** create courses, exams, or news. |
| Assessments | `Exam`, `Question`, `QuestionOption`, `Test`, `TestQuestion`, `Attempt`, `AttemptAnswer`, `Result` | Exam is a catalogue card. Test holds questions. Attempt snapshots questions at start. Result is unpublished until staff publish it. |
| Semesters | `SemesterDefinition`, `SemesterProgress`, `Project`, `ProjectSubmission`, `ProjectReview`, `SemesterReview` | Certification path. Approve unlocks the next semester index in one transaction. |
| Files | `MediaAsset`, `Resource`, `DownloadSession`, `OfflineGrant` | PDF/video metadata, short-lived delivery token, HMAC offline grant |
| Documents | `DocumentTemplate`, `IssuedDocument` | Certificate or admit card, public verify token |
| Editorial | `ContentCategory`, `EditorialItem`, `FactReaction` | News, awareness, facts, interview. `kind` separates them. |
| Live | `LiveClass`, `LiveClassReminder`, `LiveClassHand` | Schedule, reminder flag, raised-hand flag |
| Commerce | `Product`, `Coupon`, `Order`, `RefundRequest` | Manual orders. No payment gateway call. |
| Ops | `NotificationTemplate`, `NotificationCampaign`, `SupportCase`, `AppSetting`, `LegalPage`, `AuditEvent`, `Entitlement` | Push is recorded, not delivered, unless a provider env is set. Audit is append-only. |

Entitlement states: `active`, `revoked`, and the other `EntitlementState` values. Download and course access require `active` and `endsAt` null or in the future.

Resource kinds: video, pdf, and the other `ResourceKind` values. Document types: `certificate`, `admit_card`. Document statuses include `issued`, `revoked`, `superseded`, `not_issued`.

---

## 5. Workflows

### 5.1 Staff sign-in

1. Admin opens `/login`.
2. `POST /api/admin/auth/login` with `{ email, password }`. Password minimum 6 characters.
3. API checks bcrypt hash, loads roles, returns `{ accessToken, user: { id, email, name, roles, permissions } }`.
4. Admin stores the token and sends it on later calls.
5. On refresh, `GET /api/admin/auth/me` rebuilds the same user. A 401 clears the token and returns to login.
6. Sidebar hides items whose `permission` is missing. The route itself is still mounted; the API rejects the call with `403 FORBIDDEN`.

### 5.2 Learner sign-in and profile

1. `POST /api/auth/register` creates an **active** learner, lowercases email, hashes the password, returns `{ accessToken, learner }`. Optional `phone`, `city`. Duplicate email is `400 EMAIL_IN_USE` with `fieldErrors.email = "taken"`.
2. `POST /api/auth/login` same response. Wrong password or a non-active account is `401`.
3. `GET /api/me` returns the profile. `PATCH /api/me` updates `firstName`, `lastName`, `phone`, `city`, `appVersion`.
4. Profile fields the app can rely on: `id`, `firstName`, `lastName`, `email`, `phone`, `city`, `accountState`, `verifiedEmail`, `verifiedPhone`, `appVersion`, `batchId`.

Register creates `pending_verification` with `verifiedEmail: false`, queues an email OTP (`EmailOutbox` worker), and returns `challengeId`. Verify with `POST /auth/challenges/:id/verify`. Password reset: `POST /auth/password/forgot` → `verify` → `reset`. `verifiedPhone` stays false (SMS not implemented).

### 5.3 Home

`GET /api/home` is public. `GET /api/home/me` is the same payload plus the signed-in learner’s in-progress lessons.

Returned object:

| Field | Rule |
|---|---|
| `banners` | `lifecycle = published`, `placement = hero`, `imageUrl` non-empty, `startsAt` null or in the past, `endsAt` null or in the future. Ordered by `priority` desc, then `publishedAt` desc. Max 8. Empty `targetKind` / `targetRef` become `null`. |
| `sections` | Published explore sections with `homeVisible` and the same time window, ordered by `sortOrder`. |
| `featuredCourses` | Published courses with `featured = true`, excluding `hidden_internal`. Max 8. Fields: `id`, `slug`, `title`, `shortTitle`, `summary`, `description`, `commercialMode`, `deliveryType`, `estimatedMinutes`, `coverImageUrl`, `iconUrl`. |
| `continuing` | Only for `home/me`. Up to 5 lesson-progress rows whose status is not `completed`: `lessonId`, `title`, `courseId`, `courseTitle`, `progressPct`. |

The Computer Courses screen must use `GET /courses`, not `featuredCourses`. Home banners are images only: the app draws `imageUrl` and, if both are set, navigates with `targetKind` + `targetRef`. Title and button text are not drawn on the slide.

`GET /api/categories` returns published, in-window explore sections ordered by category then `sortOrder`. These are navigation tiles. They do not fill Courses, Exams, News, Facts, Awareness, or Interview.

`GET /api/search?q=` searches published course title, summary, and slug, and published lesson titles whose course is published. Empty `q` returns `{ courses: [], lessons: [] }`. Max 20 each. This search does **not** exclude `hidden_internal` courses.

### 5.4 Courses, enrol, lessons, progress

1. Staff creates a course (`draft`), uploads a cover via the image-upload slot, adds lessons, then publishes.
2. Learner `GET /api/courses?search=&pricing=free|paid&cursor=` lists published courses. `pricing=free` is `commercialMode = free`. `pricing=paid` is everything except `free` and `hidden_internal`. Each item includes `access`.
3. `GET /api/courses/:id` returns the course plus published lessons (`id`, `courseId`, `title`, `description`, `sortOrder`, `durationMinutes`, `contentType`, `isPreview`) and `access`. Optional learner token changes `access`.
4. `GET /api/courses/:id/access` is the same payload and **requires** a learner token.
5. `POST /api/courses/:id/enroll` requires a learner token. Free courses enrol with `source = self_enroll`. Other modes enrol only when `resolveCourseAccess` is granted, with `source = entitlement`. Otherwise `403 ACCESS_DENIED`. Repeat enrol sets status back to `active`.
6. `GET /api/courses/:id/lessons` and `GET /api/lessons/:id` are public. Lesson detail strips `mediaUrl` and returns `hasMedia` instead. Playback bytes are not on this route.
7. `POST /api/lessons/:id/progress` with `{ progressPct?: 0-100, positionSeconds?: int }` upserts progress as `in_progress`. It does **not** check enrolment.
8. `POST /api/lessons/:id/complete` sets `progressPct = 100`, `status = completed`, `completedAt = now`. It does **not** check enrolment.
9. `GET /api/me/enrollments` includes the course `{ id, title, slug, lifecycle }`.
10. `GET /api/me/entitlements` returns the learner’s entitlement rows.

Course publish fails with `COURSE_INVALID` when the course has zero lessons.

### 5.5 Video and protected downloads

Admin Lessons screen:

1. `POST /api/admin/resources/video-uploads` asks Cloudinary or Mux for a direct upload URL. The browser PUTs the file to that host, not through the API.
2. A draft video `Resource` is stored and linked to a course and lesson.
3. `GET /api/admin/resources/:id/video-status` refreshes provider status.
4. `GET /api/admin/resources/:id/video-playback` is the staff preview URL.
5. `POST /api/admin/resources` creates a non-video resource (PDF and others) with storage metadata.
6. `PATCH /api/admin/resources/:id` updates title, course, semester, lesson, `downloadable`, `previewAllowed`.

Learner:

1. `POST /api/resources/:id/download-authorization` with optional `{ deviceId, installationId }`.
2. Access is granted when any of these is true: an active resource-scoped entitlement, the lesson is preview or `previewAllowed`, the parent course access is granted **and** `resource.downloadable` is true for download, or an issued unexpired document points at the resource.
3. Response includes `playback` for video (`cloudinary_hls` or `mux_hls` with `url`, or `video_hls` with `url: null` and `status: not_ready_or_signing_not_configured`), `delivery.url` (short-lived, default 15 minutes via `DOWNLOAD_SESSION_TTL_SECONDS`), `offlineAuthorization` (HMAC-SHA256 over canonical JSON, kid from `OFFLINE_GRANT_KID`), and `drm` (ready only when scheme, content id, and license URL are set).
4. `GET /api/protected/delivery/:resourceId?token=` checks the token, marks `usedAt`, and returns **metadata only** (`status: metadata_only_until_storage_wired` or `missing_media_asset`). It does not stream file bytes.
5. `GET /api/crypto/offline-verification` is public and returns `{ kid, algorithm: "HMAC-SHA256", note, status }`. It never returns the HMAC secret.

Play video from `playback.url`. Do not treat `delivery.url` as an HLS stream.

### 5.6 Competitive exams and tests (learner can read, cannot sit)

1. Staff creates an exam (`draft`) and publishes it (`content.publish`).
2. Staff creates questions (`draft`), each with at least two options. Approve sets `status = approved` and requires the assessment publish permission.
3. Staff creates a test, sets `questionIds` (only approved questions are attached; count and `maxScore` update; revision increments), then publishes.
4. Publish fails with `TEST_INVALID` if there are no questions, the stored count disagrees, any question is not approved, or any question lacks exactly one correct option.
5. Learner `GET /api/exams` pages published exams. `pricing=free|paid` filters `commercialMode`. Each item: `id`, `title`, `summary`, `description`, `pricing` (`paid` only when mode is `paid`, otherwise `free`), `commercialMode`, `iconKey`, `themeKey`, `imageUrl`, `testCount` (published tests), `learnerCount` (a stored integer, not a live count of learners), `relatedExams` (string ids), `access`.
6. `GET /api/exams/:id` is one exam.
7. `GET /api/tests?examId=` returns a bare array of published tests. `GET /api/tests/:id` is one test: `id`, `examId`, `title`, `questionCount`, `durationMinutes`, `pricing`, `mode`, `marking`, `negativeMarking` (the label, or `-0.25` / `0`), `passThreshold`, `attemptLimit`, `access`.

**There is no learner route to start an attempt, save an answer, or submit a test.** Those routes are staff-only under `/api/admin/attempts`. A daily-test button in the app can see a published practice test, and it cannot submit it through this API.

Question types in the enum include more than `single_choice`. Scoring uses the option id stored in the attempt snapshot and treats one option as correct. The admin UI is built for single choice.

### 5.7 Staff attempt and result

1. `POST /api/admin/attempts` with `{ testId, learnerId }` on a **published** test. Status becomes `in_progress`. `expiresAt` is now plus `durationMinutes`. `snapshotJson` stores prompts, marks, negative marks, option ids and labels, and `correctOptionId`.
2. `POST /api/admin/attempts/:id/answers/:questionId` with `{ selectedOptionId }` while status is `created` or `in_progress` and not expired. The admin Attempts screen does **not** call this. It only creates and submits, so a submit from the UI scores every question as skipped unless answers were posted another way.
3. `POST /api/admin/attempts/:id/submit` scores from the snapshot, not from the live question row. Correct adds marks. Wrong subtracts `negativeMarks` only when the test’s `negativeMarking` flag is true. Unanswered increments skipped. `passed` is `percentage >= passThreshold`. Attempt becomes `result_unpublished`. A `Result` row is upserted with `published: false`. Submitting again is idempotent and returns the existing attempt.
4. `POST /api/admin/results/:id/publish` or `POST /api/admin/results/by-test/:testId/publish` sets `published: true`. The learner API never returns results, so publishing does not change anything the app can read today.

### 5.8 News, awareness, facts, interview

One admin screen (`EditorialPage`) drives four routes. `kind` is `news`, `awareness`, `fact`, or `interview`.

Staff:

1. `POST /api/admin/content-categories` creates a chip/category as draft. `POST .../:id/publish` publishes it.
2. `POST /api/admin/editorial` creates an item as draft. `POST .../:id/publish` publishes it.
3. Until **both** the category and the item are published, the learner list stays empty.

Learner news:

- `GET /api/news/categories` page of published news categories: `id`, `title`, `summary`, `pricing`, `iconKey`, `access` (guest access only; learner id is not applied).
- `GET /api/news?categoryId=&search=&cursor=` page. Item: `id`, `categoryId`, `title`, `excerpt`, `byline` (default `RACI News`), `publishedAt`, `readingMinutes` (default 3), `tags`, `featured`, `imageUrl`, `access`. List items omit `body`.
- `GET /api/news/:id` adds `body` (string array; JSON array in storage, otherwise one string) and `highlights`. Both are empty when `access.granted` is false.

Learner awareness (topics **are** editorial items, not categories):

- `GET /api/awareness/topics` page: `id`, `title`, `summary`, `pricing`, `commercialMode`, `iconKey` (default `book`), `imageUrl`, `access`.
- `GET /api/awareness/topics/:id` adds `schema` (default `pairs`), `summaryChips`, `entries`. `entries` is empty when access is not granted.

Learner facts:

- `GET /api/facts/categories` same category page shape as news, kind `fact`.
- `GET /api/facts?categoryId=&cursor=` and `GET /api/facts/:id`: `id`, `categoryId`, `text` (summary or title), `explanation`, `reactionCount`, `reacted`, `bookmarked`, `featured`, `quizId`. No `access` object. Body is always returned.
- `PUT /api/facts/:id/reaction` with `{ reacted: boolean }` requires a learner token. It upserts `FactReaction` and increments or decrements `reactionCount` by 1 only when the flag actually changes. Bookmark is preserved and is **not** set by this route. Response is the fact object. HTTP 200.

Learner interview:

- `GET /api/interview/categories` category page. The controller declares optional learner auth on this route but the service does not receive the learner id, so access stays the guest projection.
- `GET /api/interview/questions?categoryId=` bare array. `GET /api/interview/questions/:id` one object: `id`, `categoryId`, `prompt`, `modelAnswer`. No auth and no lock. Model answers are public for every published question.

### 5.9 Live classes

1. Staff `POST /api/admin/live-classes` creates `status = draft`, stores `audienceLearnerIdsJson`, optional `batchId` and `courseId`. Provider is `daily` when Daily.co env is set, otherwise `unconfigured`.
2. `POST /api/admin/live-classes/:id/schedule` moves it to `scheduled`. Without Daily.co, `joinUrl` stays null and `recordingStatus` is `not_available`. With Daily.co, the service creates a room and stores the join URL (see `platform.service.ts` `scheduleLiveClass`).
3. Learner `GET /api/live-classes?from=&to=` returns a bare array. `from` and `to` are ISO timestamps compared to `startsAt`. Draft classes are excluded. Visible statuses: `scheduled`, `starting`, `live`, `reconnecting`, `ended`, `cancelled`, `provider_unavailable`.
4. Mapped item: `id`, `title`, `startsAt`, `endsAt`, `instructorName` (`hostName` or `RACI Faculty`), `status` (`provider_unavailable` and `draft` are reported as `scheduled`), `batch` (batch **name** or null), `durationLabel` (`N min`), `viewerCount`, `recordingAvailable` (playback URL set and recording status is `ready`, `available`, or `published`), `reminderSet` (false for guests).
5. `GET /api/live-classes/:id` is one class.
6. `POST /api/live-classes/:id/join` requires a learner token. Join is allowed when status is `starting`, `live`, or `reconnecting`, or when a recording is available. If `audienceLearnerIdsJson` is a non-empty list, the learner must be in it. If a batch is also set, batch membership or `Learner.batchId` can satisfy the check when the learner is not in the explicit list. Response: `{ playbackUrl, chatAvailable: false, expiresAt }`. `playbackUrl` is `playbackUrl` or `joinUrl`. Chat is always false.
7. `PUT /api/live-classes/:id/reminder` with `{ enabled: boolean }` returns **204** and an empty body.
8. `PUT /api/live-classes/:id/hand` with `{ raised: boolean }` returns `{ raised }`.

### 5.10 Semesters and projects

This path is staff-only. The learner API has no project or semester routes.

1. `POST /api/admin/semesters` creates a `SemesterDefinition` on a course with an `index`.
2. `POST /api/admin/projects` creates a project on a course, optionally tied to a semester.
3. `POST /api/admin/projects/:id/submissions` with `{ learnerId, textBody? }` records a submission.
4. `POST /api/admin/projects/submissions/:submissionId/accept` or `.../request-changes` with `{ learnerFeedback, internalNotes? }`. Accept needs `semester.approve`. Request-changes needs `semester.review`.
5. `POST /api/admin/semester-reviews/submit` with `{ enrollmentId, semesterId }`. It counts accepted submissions against the semester’s projects. If any required project is not accepted, it returns `400 REQUIREMENTS_INCOMPLETE` plus a `checklist`. A review already `pending_review` is returned as-is. Progress becomes `pending_review`.
6. `POST /api/admin/semester-reviews/:id/approve` in one transaction: review `approved`, current semester `approved` or `course_complete` when no next index exists, and the next semester’s progress `available`. Approving an already-approved review is idempotent.
7. `POST .../request-changes` requires `learnerFeedback`. Status becomes `changes_required`.

### 5.11 Documents

1. Optional `POST /api/admin/document-templates` (`documents.generate`). The admin UI has **no** template screen, so templates are API-only.
2. `POST /api/admin/documents/issue` creates an issued document for a learner (`certificate` or `admit_card`), optional course, serial, expiry, snapshot JSON, and a verify token.
3. `POST /api/admin/documents/:id/revoke` with `{ reason }` needs `documents.revoke`.
4. Learner `GET /api/me/documents` and `GET /api/me/documents/:id`.
5. Public `GET /api/documents/verify/:token` checks the token without a login.
6. File bytes still go through download authorization, and delivery is metadata until object storage is connected.

### 5.12 Entitlements

`GET /api/admin/entitlements`, `POST /api/admin/entitlements/grant`, `POST /api/admin/entitlements/:id/revoke`. Grant body: `learnerId`, optional `courseId`, `scopeKind`, `scopeRef`, `source`, `canDownload`, `canPreview`, `endsAt`, `grantReason`. Revoke body: `{ reason, state? }`.

**The admin UI has no Entitlements screen.** Paid course enrol, paid downloads, and `access.granted` on courses depend on these rows (or on an active enrolment). A paid course published in admin stays locked in the app until someone grants an entitlement through the API or a seed.

Grant does not run from order reconcile. Marking an order `paid_manual` does **not** create an entitlement.

### 5.13 Commerce, notifications, support, settings, legal

Orders:

1. Create a product (`sku`, `title`, `pricePaise`, optional `courseId`) and optionally a coupon (`code` uppercased, `percentOff` or `amountOffPaise`).
2. `POST /api/admin/orders` with `{ learnerId, productId }` stores `pending`. Provider status is `not_configured` or `configured_pending_adapter`. No checkout URL is returned.
3. `POST /api/admin/orders/:id/reconcile` with `{ externalReference }` (min 4 characters) sets `paid_manual`. Permission is `payments.refund_approve`, which is stricter than the screen’s `payments.read`. A staff user who can open Orders may be forbidden to reconcile.
4. `POST /api/admin/refunds` needs `payments.refund_request`. `POST .../approve` needs `payments.refund_approve` and sets `approved_manual`. The response includes a message that no gateway refund was sent. The Refunds nav item requires `payments.refund_approve`, so a user who may request refunds but not approve them cannot open the screen that creates requests.

Notifications:

1. Templates and campaigns are stored.
2. `POST /api/admin/notifications/:id/send` needs `notifications.send_bulk` (stronger than the screen’s `notifications.send_single`). Without a push provider the campaign becomes `not_sent` with `failureReason` set. Nothing is delivered to a phone.

Support cases are internal notes (`subject`, `body`, optional `learnerId`, status string). Learners cannot open them.

Settings are key/value rows (`POST /api/admin/settings` with `{ key, value }`).

Legal:

- Staff edits `/legal` in the admin app, which calls `/api/admin/legal`.
- Public list and page: `GET /api/legal?locale=` and `GET /api/legal/:slug?locale=`. Default locale `en`.
- The admin app also renders `/policies` and `/policies/:slug` for humans. Those are admin-frontend routes, not API routes.

Reports: `GET /api/admin/reports/summary` is a counts payload for the Reports page. It is separate from the dashboard payload.

Audit: `GET /api/admin/audit-events` is the newest audit rows. Mutations across modules call `audit.write`. The learner cannot read this log.

### 5.14 Batches and learners

Learners screen lists, opens one learner, opens activity, suspends, and reactivates. It does **not** call create or patch, so new learners come from the app’s register endpoint or from `POST /api/admin/learners` used outside the UI.

Suspend and reactivate need `users.suspend`.

Batches: create with `{ name, subject?, startDate?, endDate?, learnerIds? }`. Update is the same fields, all optional. Delete needs `enrollments.revoke`. The Batches screen lists, creates, and updates. It does not call delete.

`BatchesController` is mounted at **both** `admin/batches` and `batches`. So `/api/batches` exists, but it still requires a **staff** token and `users.read`. The learner app must not call it.

---

## 6. Admin screen to endpoint map

Token on every row except the public legal pages. “UI calls it” means the React page in `apps/admin` issues that request today.

| Admin route | Screen | API it calls | Permission the nav uses |
|---|---|---|---|
| `/login` | Login | `POST /admin/auth/login` | public page |
| `/` | Dashboard | `GET /admin/dashboard` | any staff |
| `/learners` | Learners | `GET /admin/learners`, `GET /admin/learners/:id`, `GET /admin/learners/:id/activity`, `POST .../suspend`, `POST .../reactivate` | `users.read` (suspend needs `users.suspend`) |
| `/staff` | Staff | `GET /admin/staff`, `GET /admin/roles`, `POST /admin/staff`, `PATCH /admin/staff/:id` | `admins.manage` |
| `/batches` | Batches | `GET /admin/batches`, `GET /admin/batches/:id`, `POST /admin/batches`, `PATCH /admin/batches/:id`, `GET /admin/learners` | `users.read` to see the page; create needs `enrollments.create` |
| `/courses` | Courses | `POST /admin/courses/image-uploads`, `GET /admin/courses`, `POST /admin/courses`, `PATCH /admin/courses/:id`, `POST .../publish`, `POST .../lessons` | `content.edit` |
| `/semesters` | Semesters | `GET /admin/semesters`, `POST /admin/semesters`, `GET /admin/semester-reviews`, `POST /admin/semester-reviews/submit`, `POST .../:id/approve`, `POST .../:id/request-changes`, `GET /admin/courses` | `semester.review` |
| `/lessons` | Lessons & resources | `GET /admin/resources`, `GET /admin/courses`, `GET /admin/courses/:id`, `POST /admin/resources/video-uploads`, `POST /admin/resources`, `PATCH /admin/resources/:id`, `GET .../video-status`, `GET .../video-playback` | `content.edit` |
| `/projects` | Projects | `GET /admin/projects`, `GET /admin/projects/submissions?status=submitted`, `POST /admin/projects`, `POST /admin/projects/:id/submissions`, `POST .../accept` or `request-changes`, courses and learners lists | `semester.review` |
| `/questions` | Question bank | `GET /admin/questions`, `POST /admin/questions`, `POST /admin/questions/:id/approve` | `assessments.author` |
| `/exams` | Competitive exams | `GET /admin/exams`, `POST /admin/exams`, `POST /admin/exams/:id/publish` | `content.edit` |
| `/tests` | Tests | `GET /admin/tests`, `GET /admin/exams`, `GET /admin/questions?status=approved`, `POST /admin/tests`, `POST /admin/tests/:id/questions`, `POST .../publish` | `assessments.author` |
| `/attempts` | Attempts | `GET /admin/attempts`, `GET /admin/tests`, `GET /admin/learners`, `POST /admin/attempts`, `POST /admin/attempts/:id/submit` | `results.read` to view; create needs `assessments.author` |
| `/results` | Results | `GET /admin/results`, `POST /admin/results/:id/publish` | `results.read` |
| `/live-classes` | Live | `GET /admin/live-classes`, `GET /admin/batches`, `GET /admin/learners`, `GET /admin/batches/:id`, `POST /admin/live-classes`, `POST .../:id/schedule` | `live.schedule` |
| `/explore` | Explore | `GET /admin/explore-sections`, `POST /admin/explore-sections`, `PATCH /admin/explore-sections/:id`, `POST .../publish` | `explore.manage` |
| `/banners` | Banners | image upload, list, create, patch, publish, pause | `banners.manage` |
| `/news` `/awareness` `/facts` `/interview` | Editorial | `GET/POST /admin/editorial?kind=`, `POST .../:id/publish`, `GET/POST /admin/content-categories?kind=`, `POST .../:id/publish` | `content.edit` |
| `/products` | Products | `GET/POST /admin/products` | `payments.read` |
| `/coupons` | Coupons | `GET/POST /admin/coupons` | `payments.read` |
| `/orders` | Orders | `GET/POST /admin/orders`, `POST /admin/orders/:id/reconcile` | `payments.read` |
| `/refunds` | Refunds | `GET/POST /admin/refunds`, `POST .../:id/approve` | `payments.refund_approve` |
| `/notifications` | Notifications | `GET/POST /admin/notifications`, `POST .../:id/send` | `notifications.send_single` |
| `/notification-templates` | Templates | `GET/POST /admin/notification-templates` | `notifications.send_single` |
| `/certificates` `/admit-cards` | Documents | `GET /admin/documents`, `POST /admin/documents/issue`, `POST .../:id/revoke` | `documents.issue` |
| `/support` | Support | `GET/POST /admin/support-cases`, `PATCH /admin/support-cases/:id` | nav has no key; API needs `users.read` / `users.update` |
| `/legal` | Legal editor | `GET/POST /admin/legal`, `PATCH /admin/legal/:id`, `POST .../publish` | nav has no key; writes need content permissions |
| `/policies` `/policies/:slug` | Public policy pages | `GET /legal` and `GET /legal/:slug` | public |
| `/reports` | Reports | `GET /admin/reports/summary` | `reports.read` |
| `/audit` | Audit | `GET /admin/audit-events` | `audit.read` |
| `/settings` | Settings | `GET/POST /admin/settings` | `settings.manage` |
| `/students` | redirect | sends the browser to `/learners` | — |

Logout in the header clears local storage only.

### Admin endpoints the UI never calls

These work if you call them with a staff token. They are not wired to a button.

| Method | Path | Why it matters |
|---|---|---|
| POST | `/api/admin/auth/logout` | Server returns `{ ok: true }` and forgets nothing |
| POST | `/api/admin/learners` | Create a learner without the app |
| PATCH | `/api/admin/learners/:id` | Edit name, email, phone, city, batch, notes |
| DELETE | `/api/admin/batches/:id` | Delete a batch |
| GET | `/api/admin/courses/:id` | Used by the Lessons screen, not by the Courses list |
| POST | `/api/admin/courses/:id/unpublish` | Hide a course from the app |
| GET | `/api/admin/banners/:id` | Single banner |
| POST | `/api/admin/explore-sections/reorder` | Body `{ orderedIds }` |
| GET | `/api/admin/explore-sections/:id` | Single section |
| GET | `/api/admin/questions/:id` | Single question |
| PATCH | `/api/admin/questions/:id` | Edit prompt, options, marks |
| POST | `/api/admin/questions/:id/retire` | Retire a question |
| GET | `/api/admin/exams/:id` | Single exam |
| PATCH | `/api/admin/exams/:id` | Edit an exam |
| GET | `/api/admin/tests/:id` | Single test |
| PATCH | `/api/admin/tests/:id` | Edit a test |
| GET | `/api/admin/attempts/:id` | Attempt with answers |
| POST | `/api/admin/attempts/:id/answers/:questionId` | The only way to record a selected option |
| POST | `/api/admin/results/by-test/:testId/publish` | Publish every result on a test |
| GET | `/api/admin/results/:id` | Single result |
| GET | `/api/admin/projects/:id` | Single project |
| GET | `/api/admin/entitlements` | List grants |
| POST | `/api/admin/entitlements/grant` | Unlock a paid course or resource |
| POST | `/api/admin/entitlements/:id/revoke` | Lock it again |
| GET | `/api/admin/document-templates` | List templates |
| POST | `/api/admin/document-templates` | Create a template |

Also mounted twice: every batch route under `/api/batches/...` as well as `/api/admin/batches/...`, same staff guard.

---

## 7. Learner app to endpoint map

Prefix `/api`. “Handover” is `docs/update 031126/`. “In this source” is this repository on 10 November 2026.

| App screen (handover name) | Calls | In this source | Aligned when |
|---|---|---|---|
| Register / login | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` | yes | Token stored; logout discards it locally |
| Profile | `GET /me`, `PATCH /me` | yes | Bearer learner token |
| Home | `GET /home` or `GET /home/me` | yes | Banners need a non-empty `imageUrl` and `placement = hero` |
| Home live strip | `GET /live-classes?from=&to=` | yes | Class must be scheduled, not left in `draft` |
| Explore tiles | `GET /categories` | yes | Tiles are not catalogues |
| Search | `GET /search?q=` | yes | Courses and lessons only |
| Computer Courses | `GET /courses`, `GET /courses/:id`, `GET /courses/:id/lessons` | yes | Course **and** each lesson must be `published` |
| Course access | `GET /courses/:id/access`, `POST /courses/:id/enroll` | yes | Paid needs an active entitlement or enrolment |
| Lesson player | `GET /lessons/:id`, `POST /lessons/:id/progress`, `POST /lessons/:id/complete` | yes | Media URL is hidden; use download-authorization for video |
| My learning | `GET /me/enrollments`, `GET /me/entitlements` | yes | |
| Competitive exams | `GET /exams`, `GET /exams/:id`, `GET /tests?examId=`, `GET /tests/:id` | yes | Exam and test both published. Sitting the test is **not** implemented |
| News | `GET /news/categories`, `GET /news`, `GET /news/:id` | yes | Category and article both published. Paid body stays empty |
| Awareness | `GET /awareness/topics`, `GET /awareness/topics/:id` | yes | Item published. Paid `entries` stay empty |
| Facts | `GET /facts/categories`, `GET /facts`, `GET /facts/:id`, `PUT /facts/:id/reaction` | yes | Reaction needs a learner token |
| Interview | `GET /interview/categories`, `GET /interview/questions`, `GET /interview/questions/:id` | yes | Answers are public once published |
| Live tab and room | `GET /live-classes`, `GET /live-classes/:id`, `POST .../join`, `PUT .../reminder`, `PUT .../hand` | yes | Join needs a live/starting/reconnecting status or a ready recording |
| Documents | `GET /me/documents`, `GET /me/documents/:id`, `GET /documents/verify/:token` | yes | |
| Downloads | `POST /resources/:id/download-authorization`, `GET /protected/delivery/:resourceId?token=`, `GET /crypto/offline-verification` | yes | Delivery is metadata, not file bytes |

The 3 November handover files say `GET /courses`, `GET /exams`, `GET /tests`, `GET /news`, `GET /live-classes`, and the other new catalogues returned 404 on `https://redi-api-production.up.railway.app/api`. Re-check that host. This source no longer 404s those paths when the process is this build.

---

## 8. Every endpoint

Auth column: **Public**, **Staff**, **Learner**, **Learner optional** (anonymous works; a learner token changes `access` or `reminderSet` when the handler reads it).

### 8.1 Health and public legal

| Method | Path | Auth | Body / query | Result |
|---|---|---|---|---|
| GET | `/api/health` | Public | — | `{ status: "ok", database: "ok" }`. Database down: `503` `{ code: "DATABASE_UNAVAILABLE" }` |
| GET | `/api/legal` | Public | `locale` optional, default `en` | Published legal pages for that locale |
| GET | `/api/legal/:slug` | Public | `locale` optional | One published page. Unknown slug is not found |

### 8.2 Staff auth, people, dashboard

| Method | Path | Auth | Permission | Body / query | What it does |
|---|---|---|---|---|---|
| POST | `/api/admin/auth/login` | Public | — | `{ email, password }` | Returns `{ accessToken, user }` |
| GET | `/api/admin/auth/me` | Staff | any staff | — | Current staff profile and permissions |
| POST | `/api/admin/auth/logout` | Staff | any staff | — | `{ ok: true }` |
| GET | `/api/admin/dashboard` | Staff | any staff | — | Counts: learners, enrolments, courses, explore, banners, review queue, 8 recent audit rows |
| GET | `/api/admin/staff` | Staff | `admins.manage` | — | Staff list |
| GET | `/api/admin/roles` | Staff | `admins.manage` | — | Roles and their permission keys |
| POST | `/api/admin/staff` | Staff | `admins.manage` | `{ email, name, password, roleKey }` | Creates a staff user and assigns one role |
| PATCH | `/api/admin/staff/:id` | Staff | `admins.manage` | `{ isActive?, roleKey? }` | Activate/deactivate or change role |
| GET | `/api/admin/learners` | Staff | `users.read` | `q` optional search | Learner list. UI sends `?q=` |
| GET | `/api/admin/learners/:id` | Staff | `users.read` | — | One learner |
| GET | `/api/admin/learners/:id/activity` | Staff | `users.read` | — | Activity projection for the drawer |
| POST | `/api/admin/learners` | Staff | `users.update` | `{ firstName, lastName, email?, phone?, city?, batchId?, source? }` | Creates a learner record. This does not by itself create `LearnerCredential`. App login needs register or a credential row. |
| PATCH | `/api/admin/learners/:id` | Staff | `users.update` | same fields plus `internalNotes` | Updates the learner |
| POST | `/api/admin/learners/:id/suspend` | Staff | `users.suspend` | — | `accountState = suspended`. Later learner login returns 401 |
| POST | `/api/admin/learners/:id/reactivate` | Staff | `users.suspend` | — | Back to `active` |
| GET | `/api/admin/batches` and `/api/batches` | Staff | `users.read` | — | Batch list |
| GET | `/api/admin/batches/:id` and `/api/batches/:id` | Staff | `users.read` | — | Batch plus members |
| POST | `/api/admin/batches` and `/api/batches` | Staff | `enrollments.create` | `{ name, subject?, startDate?, endDate?, learnerIds? }` | Creates a batch and optional roster |
| PATCH | `/api/admin/batches/:id` and `/api/batches/:id` | Staff | `enrollments.create` | partial create body | Updates batch and roster |
| DELETE | `/api/admin/batches/:id` and `/api/batches/:id` | Staff | `enrollments.revoke` | — | Deletes the batch |
| GET | `/api/admin/audit-events` | Staff | `audit.read` | — | Audit list, newest first |
| GET | `/api/admin/reports/summary` | Staff | `reports.read` | — | Operations summary for the Reports page |
| GET | `/api/admin/settings` | Staff | `settings.manage` | — | All settings |
| POST | `/api/admin/settings` | Staff | `settings.manage` | `{ key, value }` | Upsert one setting |

### 8.3 Courses, explore, banners, resources

| Method | Path | Auth | Permission | Body / query | What it does |
|---|---|---|---|---|---|
| GET | `/api/admin/courses` | Staff | `content.edit` | — | All courses, any lifecycle |
| POST | `/api/admin/courses/image-uploads` | Staff | `content.edit` | — | Returns an upload slot (Cloudinary) for cover or icon |
| GET | `/api/admin/courses/:id` | Staff | `content.edit` | — | Course with lessons |
| POST | `/api/admin/courses` | Staff | `content.create` | `{ slug, title, shortTitle?, summary?, description?, deliveryType?, commercialMode?, featured?, estimatedMinutes?, coverImageUrl?, iconUrl? }` | Draft course. `deliveryType`: `standard` or `semester_certification`. `commercialMode` defaults to `free` in the database |
| PATCH | `/api/admin/courses/:id` | Staff | `content.edit` | same fields except `slug` is not editable | Updates the course |
| POST | `/api/admin/courses/:id/publish` | Staff | `content.publish` | — | Sets course `published`. Fails if there are zero lessons. Does not publish lessons |
| POST | `/api/admin/courses/:id/unpublish` | Staff | `content.publish` | — | Sets `unpublished` |
| POST | `/api/admin/courses/:id/lessons` | Staff | `content.edit` | `{ title, description?, sortOrder?, durationMinutes?, contentType?, isPreview? }` | Creates a **draft** lesson |
| GET | `/api/admin/explore-sections` | Staff | `explore.manage` | — | All sections |
| POST | `/api/admin/explore-sections/reorder` | Staff | `explore.manage` | `{ orderedIds: string[] }` | Rewrites `sortOrder` |
| GET | `/api/admin/explore-sections/:id` | Staff | `explore.manage` | — | One section |
| POST | `/api/admin/explore-sections` | Staff | `explore.manage` | `{ slug, title, description?, badge?, category?, targetKind, targetRef, pricingFilter?, sortOrder?, featured?, homeVisible?, iconKey?, themeKey? }` | Draft section. `category` is `learn`, `prepare`, or `discover` |
| PATCH | `/api/admin/explore-sections/:id` | Staff | `explore.manage` | partial, no slug | Update |
| POST | `/api/admin/explore-sections/:id/publish` | Staff | `explore.manage` | — | Publish. Shows on `GET /categories` and, if `homeVisible`, on home |
| GET | `/api/admin/banners` | Staff | `banners.manage` | — | All banners |
| POST | `/api/admin/banners/image-uploads` | Staff | `banners.manage` | — | Image upload slot |
| GET | `/api/admin/banners/:id` | Staff | `banners.manage` | — | One banner |
| POST | `/api/admin/banners` | Staff | `banners.manage` | `{ campaignName, title, subtitle?, ctaLabel?, placement?, priority?, targetKind?, targetRef?, imageUrl?, altText?, startsAt?, endsAt? }` | Draft banner. `placement`: `hero`, `compact`, `live_class`, `modal`. Home reads **hero** only |
| PATCH | `/api/admin/banners/:id` | Staff | `banners.manage` | partial create | Update |
| POST | `/api/admin/banners/:id/publish` | Staff | `banners.manage` | — | Publish |
| POST | `/api/admin/banners/:id/pause` | Staff | `banners.manage` | — | Take the banner off the home carousel |
| GET | `/api/admin/resources` | Staff | `content.edit` | — | All resources |
| POST | `/api/admin/resources` | Staff | `content.create` | see `CreateResourceDto`: `title`, `kind`, `mimeType`, optional size, course, semester, lesson, storage, checksum, DRM, `downloadable`, `previewAllowed` | Creates a resource |
| PATCH | `/api/admin/resources/:id` | Staff | `content.edit` | `{ title?, courseId?, semesterId?, lessonId?, downloadable?, previewAllowed? }` | Empty string clears an optional link |
| POST | `/api/admin/resources/video-uploads` | Staff | `content.create` | `{ title, fileName?, mimeType?, byteSize?, courseId?, semesterId?, lessonId? }` | Direct-upload URL plus a draft video resource |
| GET | `/api/admin/resources/:id/video-status` | Staff | `content.edit` | — | Refreshes Mux/Cloudinary status |
| GET | `/api/admin/resources/:id/video-playback` | Staff | `content.edit` | — | Staff playback URL |

### 8.4 Assessments, attempts, results

| Method | Path | Auth | Permission | Body / query | What it does |
|---|---|---|---|---|---|
| GET | `/api/admin/questions` | Staff | `assessments.author` | `status` optional (`approved` used by Tests page) | Question list with options |
| GET | `/api/admin/questions/:id` | Staff | `assessments.author` | — | One question |
| POST | `/api/admin/questions` | Staff | `assessments.author` | `{ prompt, type?, explanation?, subject?, topic?, difficulty?, marks?, negativeMarks?, options[] }` | Draft question. `options` length at least 2. Each option `{ label, isCorrect, sortOrder? }` |
| PATCH | `/api/admin/questions/:id` | Staff | `assessments.author` | partial, including `status` and `options` | Edit |
| POST | `/api/admin/questions/:id/approve` | Staff | `assessments.publish` | — | `status = approved` |
| POST | `/api/admin/questions/:id/retire` | Staff | `assessments.author` | — | `status = retired` |
| GET | `/api/admin/exams` | Staff | `content.edit` | — | All exams |
| GET | `/api/admin/exams/:id` | Staff | `content.edit` | — | One exam |
| POST | `/api/admin/exams` | Staff | `content.create` | `{ title, summary?, description?, commercialMode?, iconKey?, themeKey?, imageUrl?, learnerCount?, relatedExams? }` | Draft exam |
| PATCH | `/api/admin/exams/:id` | Staff | `content.edit` | same as create, all optional in practice via the DTO which still requires `title` because `UpdateExamDto` extends create | Update. Sending a patch without `title` fails validation |
| POST | `/api/admin/exams/:id/publish` | Staff | `content.publish` | — | Publish. Learner `GET /exams` can see it |
| GET | `/api/admin/tests` | Staff | `assessments.author` | — | All tests |
| GET | `/api/admin/tests/:id` | Staff | `assessments.author` | — | Test with questions |
| POST | `/api/admin/tests` | Staff | `assessments.author` | `{ title, description?, mode?, courseId?, examId?, pricing?, marking?, negativeMarkingLabel?, semesterId?, instructions?, durationMinutes?, passThreshold?, negativeMarking?, attemptLimit?, resultPolicy? }` | Draft test. `mode` is the `TestMode` enum (`practice` is the database default) |
| PATCH | `/api/admin/tests/:id` | Staff | `assessments.author` | subset of those fields | Update. `courseId` and `semesterId` are not on the update DTO |
| POST | `/api/admin/tests/:id/questions` | Staff | `assessments.author` | `{ questionIds: string[] }` at least one | Replaces the question set. Questions must already be approved |
| POST | `/api/admin/tests/:id/publish` | Staff | `assessments.publish` | — | Publish after the checks in section 5.6 |
| GET | `/api/admin/attempts` | Staff | `results.read` | — | Attempts |
| GET | `/api/admin/attempts/:id` | Staff | `results.read` | — | One attempt and answers |
| POST | `/api/admin/attempts` | Staff | `assessments.author` | `{ testId, learnerId }` | Starts an attempt and snapshots questions |
| POST | `/api/admin/attempts/:id/answers/:questionId` | Staff | `assessments.author` | `{ selectedOptionId }` | Saves one answer |
| POST | `/api/admin/attempts/:id/submit` | Staff | `assessments.author` | — | Scores and writes an unpublished result |
| GET | `/api/admin/results` | Staff | `results.read` | — | Results |
| GET | `/api/admin/results/:id` | Staff | `results.read` | — | One result |
| POST | `/api/admin/results/:id/publish` | Staff | `results.publish` | optional reason body where the handler accepts `PublishResultsDto` | Marks that result published. No learner route reads it |
| POST | `/api/admin/results/by-test/:testId/publish` | Staff | `results.publish` | — | Publishes results for that test |

`UpdateExamDto` extends `CreateExamDto`, so `title` is still required on exam patch. The Exams page only posts create and publish, so this bites API clients that patch.

### 8.5 Projects, semesters, entitlements, documents

| Method | Path | Auth | Permission | Body | What it does |
|---|---|---|---|---|---|
| GET | `/api/admin/projects` | Staff | `semester.review` | — | Projects |
| GET | `/api/admin/projects/submissions` | Staff | `semester.review` | query `status` | Submissions. UI asks `status=submitted` |
| GET | `/api/admin/projects/:id` | Staff | `semester.review` | — | One project |
| POST | `/api/admin/projects` | Staff | `content.create` | `{ courseId, semesterId?, title, instructions? }` | Create project |
| POST | `/api/admin/projects/:id/submissions` | Staff | `semester.review` | `{ learnerId, textBody? }` | Add a submission on behalf of a learner |
| POST | `/api/admin/projects/submissions/:submissionId/accept` | Staff | `semester.approve` | `{ learnerFeedback, internalNotes? }` | Accept |
| POST | `/api/admin/projects/submissions/:submissionId/request-changes` | Staff | `semester.review` | same | Ask for changes |
| GET | `/api/admin/semesters` | Staff | `semester.review` | query `courseId` optional | Semester definitions. Each row includes the course and counts of projects and reviews |
| POST | `/api/admin/semesters` | Staff | `content.create` | `{ courseId, title, index, description? }` | Create semester |
| GET | `/api/admin/semester-reviews` | Staff | `semester.review` | — | Reviews whose status is `pending_review` only |
| POST | `/api/admin/semester-reviews/submit` | Staff | `semester.review` | `{ enrollmentId, semesterId }` | Open a pending review if projects are accepted |
| POST | `/api/admin/semester-reviews/:id/approve` | Staff | `semester.approve` | `{ learnerFeedback?, internalNotes?, reason? }` | Approve and unlock the next index |
| POST | `/api/admin/semester-reviews/:id/request-changes` | Staff | `semester.review` | `learnerFeedback` required | Send back |
| GET | `/api/admin/entitlements` | Staff | `enrollments.create` | — | Entitlements |
| POST | `/api/admin/entitlements/grant` | Staff | `enrollments.create` | `GrantEntitlementDto` | Active grant |
| POST | `/api/admin/entitlements/:id/revoke` | Staff | `enrollments.revoke` | `{ reason, state? }` | Revoke |
| GET | `/api/admin/document-templates` | Staff | `documents.generate` | — | Templates |
| POST | `/api/admin/document-templates` | Staff | `documents.generate` | `{ key, title, documentType, locale? }` | Create template. `documentType` is `certificate` or `admit_card` |
| GET | `/api/admin/documents` | Staff | `documents.issue` | query `status` optional | Issued documents. UI filters by type in the browser |
| POST | `/api/admin/documents/issue` | Staff | `documents.issue` | `{ learnerId, documentType, title, courseId?, templateId?, serial?, expiresAt?, storageKey?, pdfSha256?, snapshot? }` | Issue |
| POST | `/api/admin/documents/:id/revoke` | Staff | `documents.revoke` | `{ reason }` | Revoke |

Semester submit’s exact JSON field names are whatever `submitReview(enrollmentId, semesterId)` reads from the body in `semester-reviews.controller.ts`. The Semesters page posts that pair. If a client sends different names, validation or the service will reject the call.

### 8.6 Editorial, live, notifications, commerce, support, legal

| Method | Path | Auth | Permission | Body / query | What it does |
|---|---|---|---|---|---|
| GET | `/api/admin/editorial` | Staff | `content.edit` | `kind` = `news` \| `awareness` \| `fact` \| `interview` | Items of that kind, any lifecycle |
| POST | `/api/admin/editorial` | Staff | `content.create` | `CreateEditorialDto` (`kind`, `title`, plus optional summary, body, category, categoryId, pricing, featured, image, byline, reading time, explanation, quizId, schema, prompt, modelAnswer, and the `*Json` strings) | Draft item |
| POST | `/api/admin/editorial/:id/publish` | Staff | `content.publish` | — | Publish item |
| GET | `/api/admin/content-categories` | Staff | `content.edit` | `kind` | Categories |
| POST | `/api/admin/content-categories` | Staff | `content.create` | `{ id?, kind, title, summary?, pricing?, iconKey?, sortOrder? }` | Draft category. Optional id must match `^[a-z0-9-]{2,40}$` |
| POST | `/api/admin/content-categories/:id/publish` | Staff | `content.publish` | — | Publish category |
| GET | `/api/admin/live-classes` | Staff | `live.schedule` | — | All classes, including drafts |
| POST | `/api/admin/live-classes` | Staff | `live.schedule` | `{ title, startsAt, endsAt, courseId?, batchId?, learnerIds?, hostName?, capacity? }` | Draft class. Dates are ISO strings |
| POST | `/api/admin/live-classes/:id/schedule` | Staff | `live.schedule` | — | Schedule. Creates a Daily room only when that provider is configured |
| GET | `/api/admin/notification-templates` | Staff | `notifications.send_single` | — | Templates |
| POST | `/api/admin/notification-templates` | Staff | `notifications.send_single` | `{ key, title, body, channel? }` | Create template |
| GET | `/api/admin/notifications` | Staff | `notifications.send_single` | — | Campaigns |
| POST | `/api/admin/notifications` | Staff | `notifications.send_single` | `{ title, body, audience?, audienceRef?, templateId? }` | Draft campaign. `audience` defaults to `single` |
| POST | `/api/admin/notifications/:id/send` | Staff | `notifications.send_bulk` | — | Queue or mark not sent. Does not push unless a provider adapter is actually configured |
| GET | `/api/admin/products` | Staff | `payments.read` | — | Products |
| POST | `/api/admin/products` | Staff | `payments.read` | `{ sku, title, pricePaise, courseId? }` | Create. Price is paise (₹1 = 100) |
| GET | `/api/admin/coupons` | Staff | `payments.read` | — | Coupons |
| POST | `/api/admin/coupons` | Staff | `payments.read` | `{ code, percentOff?, amountOffPaise? }` | One of the two amounts is required |
| GET | `/api/admin/orders` | Staff | `payments.read` | — | Orders with product and refunds |
| POST | `/api/admin/orders` | Staff | `payments.read` | `{ learnerId, productId }` | Pending order at the product price. Coupon on the DTO is not applied here |
| POST | `/api/admin/orders/:id/reconcile` | Staff | `payments.refund_approve` | `{ externalReference }` | `paid_manual`. Does not grant an entitlement |
| GET | `/api/admin/refunds` | Staff | `payments.read` | — | Refund requests |
| POST | `/api/admin/refunds` | Staff | `payments.refund_request` | `{ orderId, reason, amountPaise }` | Status `requested` |
| POST | `/api/admin/refunds/:id/approve` | Staff | `payments.refund_approve` | — | `approved_manual`. No gateway call |
| GET | `/api/admin/support-cases` | Staff | `users.read` | — | Cases |
| POST | `/api/admin/support-cases` | Staff | `users.update` | `{ subject, body, learnerId? }` | Create |
| PATCH | `/api/admin/support-cases/:id` | Staff | `users.update` | `{ status }` | Change status string |
| GET | `/api/admin/legal` | Staff | any staff | — | All legal pages, including drafts |
| POST | `/api/admin/legal` | Staff | `content.create` | `{ slug, locale?, title, summary?, body, effectiveAt? }` | Slug is lowercase words and hyphens. Locale length 2–12 |
| PATCH | `/api/admin/legal/:id` | Staff | `content.edit` | `{ title?, summary?, body?, effectiveAt? }` | Edit. Slug does not change |
| POST | `/api/admin/legal/:id/publish` | Staff | `content.publish` | — | Public `GET /legal/:slug` can see it |

### 8.7 Learner auth and catalogue

| Method | Path | Auth | Body / query | Result |
|---|---|---|---|---|
| POST | `/api/auth/register` | Public | `{ firstName, lastName, email, password, phone?, city? }` | `{ accessToken, learner }` |
| POST | `/api/auth/login` | Public | `{ email, password }` | same |
| POST | `/api/auth/logout` | Public | — | `{ ok: true }` |
| GET | `/api/me` | Learner | — | Profile |
| PATCH | `/api/me` | Learner | `{ firstName?, lastName?, phone?, city?, appVersion? }` | Updated profile |
| GET | `/api/home` | Public | — | `{ banners, sections, featuredCourses, continuing: [] }` |
| GET | `/api/home/me` | Learner | — | Same, with `continuing` filled |
| GET | `/api/categories` | Public | — | Published in-window explore sections |
| GET | `/api/search` | Public | `q` | `{ courses, lessons }` |
| GET | `/api/courses` | Learner optional | `search`, `pricing` (`free` or `paid`), `cursor` | Page of courses plus `access` |
| GET | `/api/courses/:id` | Learner optional | — | Course, published lessons, `access` |
| GET | `/api/courses/:id/access` | Learner | — | Same as course detail, token required |
| POST | `/api/courses/:id/enroll` | Learner | — | Enrolment row |
| GET | `/api/courses/:id/lessons` | Public | — | Published lessons only |
| GET | `/api/lessons/:id` | Public | — | Lesson without `mediaUrl`, plus `hasMedia` |
| POST | `/api/lessons/:id/progress` | Learner | `{ progressPct?, positionSeconds? }` | Progress row, status `in_progress` |
| POST | `/api/lessons/:id/complete` | Learner | — | Progress row, status `completed` |
| GET | `/api/me/enrollments` | Learner | — | Enrolments with course summary |
| GET | `/api/me/entitlements` | Learner | — | Entitlement rows |

### 8.8 Learner exams, editorial, live

| Method | Path | Auth | Body / query | Result |
|---|---|---|---|---|
| GET | `/api/exams` | Learner optional | `search`, `pricing`, `cursor` | Page of published exams |
| GET | `/api/exams/:id` | Learner optional | — | One exam |
| GET | `/api/tests` | Learner optional | `examId` optional | **Array** of published tests |
| GET | `/api/tests/:id` | Learner optional | — | One test. No questions, no start |
| GET | `/api/news/categories` | Public | `search`, `pricing`, `cursor` | Page of published news categories |
| GET | `/api/news` | Learner optional | `categoryId`, `search`, `cursor` | Page of articles without body |
| GET | `/api/news/:id` | Learner optional | — | Article. `body` and `highlights` empty if not granted |
| GET | `/api/awareness/topics` | Learner optional | `search`, `pricing`, `cursor` | Page of topics |
| GET | `/api/awareness/topics/:id` | Learner optional | — | Topic. `entries` empty if not granted |
| GET | `/api/facts/categories` | Public | `search`, `pricing`, `cursor` | Page of fact categories |
| GET | `/api/facts` | Learner optional | `categoryId`, `cursor` | Page of facts |
| GET | `/api/facts/:id` | Learner optional | — | One fact, including explanation |
| PUT | `/api/facts/:id/reaction` | Learner | `{ reacted: boolean }` | Updated fact |
| GET | `/api/interview/categories` | Learner optional | `search`, `pricing`, `cursor` | Page of categories. Access ignores the token |
| GET | `/api/interview/questions` | Public | `categoryId` optional | **Array**. Includes `modelAnswer` |
| GET | `/api/interview/questions/:id` | Public | — | One question with `modelAnswer` |
| GET | `/api/live-classes` | Learner optional | `from`, `to` ISO | **Array** of visible classes |
| GET | `/api/live-classes/:id` | Learner optional | — | One class |
| POST | `/api/live-classes/:id/join` | Learner | — | `{ playbackUrl, chatAvailable: false, expiresAt }` |
| PUT | `/api/live-classes/:id/reminder` | Learner | `{ enabled: boolean }` | **204** empty |
| PUT | `/api/live-classes/:id/hand` | Learner | `{ raised: boolean }` | `{ raised }` |

### 8.9 Learner files and documents

| Method | Path | Auth | Body / query | Result |
|---|---|---|---|---|
| POST | `/api/resources/:id/download-authorization` | Learner | `{ deviceId?, installationId? }` | Playback, delivery URL, offline grant, DRM block, policy. See section 5.5 |
| GET | `/api/protected/delivery/:resourceId` | Public + query token | `token` required | Metadata only. Bad or expired token: `403 DELIVERY_EXPIRED` |
| GET | `/api/crypto/offline-verification` | Public | — | `{ kid, algorithm, note, status }` |
| GET | `/api/me/documents` | Learner | — | That learner’s documents |
| GET | `/api/me/documents/:id` | Learner | — | One document they own |
| GET | `/api/documents/verify/:token` | Public | — | Verification result for a certificate or admit card |

---

## 9. Alignment checklist

Use this list against the running API and the app. A row is aligned only when the admin action and the learner response match.

| Check | Pass looks like | Current source risk |
|---|---|---|
| Health | `GET /api/health` is `{ status: "ok", database: "ok" }` | Process or database down |
| Staff and learner tokens are different | Learner token on `/api/admin/courses` is 401. Staff token on `/api/me` is 401 | Using one secret does not merge the two guards; `typ: "learner"` still separates them |
| Course appears in the app | Published course is in `GET /api/courses` | Left in draft, or `hidden_internal` |
| Lessons appear | `GET /api/courses/:id/lessons` is non-empty | **Lessons created in admin stay `draft`. No publish-lesson API** |
| Featured vs full catalogue | Home featured list can be shorter than `GET /courses` | App still reading only `GET /home` |
| Hero banner shows | Banner is published, placement `hero`, `imageUrl` set, inside start/end | Image null, wrong placement, or paused |
| Explore tile is not a course | Creating an explore section does not add a course, exam, or article | Expecting the tile to fill those screens |
| Paid course unlocks | `access.granted` true after grant or enrol | **No Entitlements screen. Paying an order does not grant access** |
| Free course enrols | `POST /courses/:id/enroll` returns an active enrolment | Course not published |
| Video plays | `playback.type` is `mux_hls` or `cloudinary_hls` and `url` is set | Asset not `ready`, or signing not configured. `delivery.url` is not the stream |
| PDF downloads | Authorization returns `delivery.url` | `GET` delivery returns metadata, not bytes |
| Exam card shows | Published exam in `GET /exams` with `testCount` | Exam or its tests still draft. Explore “Competitive Exams” tile does not count |
| Learner finishes a test | Attempt stored and result visible in the app | **No learner attempt or result routes** |
| Attempt scored from the UI | Correct count greater than zero | Attempts page never posts `/answers/:questionId`, so every question is skipped |
| News story opens | Category and article published. Free article has `body` | Paid article returns `body: []` even for a signed-in learner |
| Fact reaction | `PUT` with learner token changes `reacted` and `reactionCount` | Guest gets 401. Bookmark cannot be set |
| Interview answer hidden until purchase | Locked prompt | **Model answer is public** |
| Live class on home | `GET /live-classes?from=&to=` includes it | Left in `draft` (schedule was not pressed), or `startsAt` outside the window |
| Join works | `playbackUrl` set | Status not live/starting/reconnecting and no recording. Audience list excludes the learner. Daily.co not configured so `joinUrl` is null |
| Reminder | Second `GET` shows `reminderSet: true` for that learner | Guest always sees false. Response of the PUT is empty 204, not the class |
| Certificate in the app | `GET /me/documents` lists it | Issued to another learner, or revoked |
| Notification reached the phone | Provider accepted it | Send marks `not_sent` when push is not configured |
| Refund moved money | Gateway reference | Approve only sets `approved_manual` |
| Legal page on `/policies` | Public `GET /api/legal/:slug` is published | Draft page is visible to staff and hidden from the public route |
| Production matches this file | The Railway API returns these paths with 200, not 404 | The 3 November handover recorded 404s for the catalogues. Redeploy this API before comparing the app |

### Permission mismatches inside the admin UI

| Screen action | UI allows the button when | API requires |
|---|---|---|
| Reconcile order | `payments.read` (page visibility) | `payments.refund_approve` |
| Send notification | `notifications.send_single` | `notifications.send_bulk` |
| Create refund | page requires `payments.refund_approve` | create requires `payments.refund_request` |
| Publish course, exam, editorial, legal | page visible with `content.edit` | `content.publish` |
| Approve question or publish test | page visible with `assessments.author` | `assessments.publish` |
| Accept project or approve semester | page visible with `semester.review` | `semester.approve` |
| Support page | no nav permission | `users.read` to list, `users.update` to write |

`super_admin` passes all of these. A narrower role will see a screen and then receive `403 FORBIDDEN` on the action.

---

## 10. What is intentionally not live

These are stored or stubbed. They are not a full product behaviour yet.

- Phone verification / SMS OTP (email verification + password-reset OTP are implemented via Brevo/console + outbox worker).
- Learner test-taking, result release to the app, and bookmarks on facts.
- Payment capture, coupon application at checkout, and entitlement creation from an order.
- Push delivery and live chat (`chatAvailable` is always false).
- Protected file bytes. Delivery returns storage metadata and tells the client not to use a public CDN URL.
- DRM playback until `drmScheme`, `drmContentId`, and `licenseServiceUrl` are set on the media asset.
- Lesson publish from the admin UI.
- Server-side logout and token revocation.

---

## 11. How to re-check after a change

1. Start Postgres, API (`http://localhost:3333/api`), and admin (`http://localhost:5173`). `VITE_API_BASE_URL` must be the API origin. `CORS_ORIGIN` must include the admin origin.
2. Sign in as `admin@institute.local`.
3. For one course: create, add a lesson, publish, then `GET /api/courses/:id/lessons` **without** a staff token. Confirm the lesson is present. If it is missing, the draft-lesson gap is still open.
4. Publish a hero banner with an image. `GET /api/home` must include that `imageUrl`.
5. Publish an exam and a test that contains an approved question. `GET /api/exams` and `GET /api/tests?examId=` must return them.
6. Publish a news category and a news item. `GET /api/news/categories` and `GET /api/news` must return them.
7. Create a live class and press schedule. `GET /api/live-classes` must include it. Join stays 403 until the status is live or a recording exists.
8. Register a learner, enrol in a free course, post progress, and read `GET /api/home/me`.
9. Grant an entitlement for a paid course and confirm `access.granted` on `GET /api/courses/:id` with that learner’s token.
10. Repeat the same calls against the Railway host before treating the phone app as aligned. Source and production can differ until that host is deployed from this tree.
