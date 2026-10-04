# REDI Web Admin Panel — Complete Product and Technical Requirements

> **Document status:** Build-ready product requirements for Cursor/engineering  
> **Product:** REDI — Ranjan Educational Institute  
> **Admin product:** Responsive web administration, content-management, operations, teaching, and reporting portal  
> **Learner product:** Existing React Native app (`com.rediapp.learner`)  
> **Last updated:** 2026-09-24  
> **Priority language:** `MUST`, `SHOULD`, and `MAY` are used as requirement levels.

---

## How to use this specification

- Product owners should approve Sections 1–3, 5–6, and 30–34.
- Designers should use Sections 6–23 and 28, including every state and confirmation requirement.
- Backend engineers should use Sections 2, 4, 8–27, and the learner API compatibility list.
- Admin-web engineers should use Sections 5–23 and 28–32.
- QA/security teams should use Sections 26–30 as release gates.
- Cursor should follow Section 32 and implement vertical slices; this document is requirements input, not permission to skip architecture, migrations, audit, or tests.

### Contents

1. Purpose, product context, goals, architecture, roles, and information architecture.
2. Dashboard, shared content lifecycle, Explore sections, banners, and remote app configuration.
3. Learners, batches, courses, semesters, projects, approvals, assessments, results, and live classes.
4. News/awareness/facts/interview content, notifications, certificates, admit cards, commerce, files, and support.
5. Reports, audit, data model, APIs, security, non-functional requirements, UI standards, and testing.
6. Acceptance criteria, phased delivery, Cursor implementation rules, open decisions, and product principles.

---

## 1. Purpose

Build a secure web admin panel from which authorized REDI staff can operate the complete learner platform without changing mobile-app code for normal day-to-day work.

The portal must let authorized staff:

- See the operational state of users, content, courses, enrollments, tests, attempts, results, payments, approvals, documents, notifications, and live classes.
- Create, edit, preview, schedule, publish, unpublish, archive, reorder, and localize learner-facing content.
- Create tests and question banks, configure marking rules, schedule tests, inspect attempts, publish results, and correct results through an audited workflow.
- Rename, reorder, hide, add, and change the learner app's Explore sections while retaining stable IDs and safe mobile deep links.
- Create and schedule home banners with audience, date, position, and click-target controls.
- Review semester and project submissions; approve, reject, request changes, and unlock the next approved learning stage.
- Generate, review, issue, revoke, supersede, and verify certificates and admit cards.
- Schedule, start, conduct, moderate, record, and complete live classes from the web portal.
- Send inbox and push notifications to one learner, selected learners, a saved segment, or all eligible learners.
- Resolve support, payment, access, moderation, and content issues with a complete audit trail.
- Export permitted operational reports without exposing secrets or unnecessary private data.

The panel is the control plane for the learner app. It is not a second learner application.

---

## 2. Existing product context that must be preserved

The current repository is the REDI React Native learner app. The admin portal and backend are separate deployable products, but they must share one authoritative domain model and API contract.

Current learner capabilities that the admin system must support:

1. Authentication, registration, contact verification, password reset, Google exchange, guest browsing, session refresh, and account deletion requests.
2. Home dashboard, banners/live highlights, Continue Learning, notification count, and Explore sections.
3. Computer courses, free and paid learning, lessons, resources, progress, bookmarks, and downloads.
4. Competitive exams, test lists, instructions, formal tests, daily practice, attempt resume, results, rank, and solution review.
5. Semester-based certification courses with lessons, tests, projects, review, rejection/resubmission, and admin approval.
6. Live-class schedule, join authorization, chat, hand raise, reminders, status changes, and recordings.
7. Daily news, general-awareness topics, amazing facts, and interview-preparation content.
8. Checkout, coupons, orders, payment verification, delayed entitlement, history, and receipts.
9. Learner profile, achievements, notification inbox, certificates, admit cards, support, legal pages, and preferences.

### 2.1 Non-negotiable compatibility rules

- Server IDs are stable and never derived from editable titles.
- Renaming an Explore section, course, test, or banner must not break existing bookmarks, enrollments, attempts, notifications, or deep links.
- The server is authoritative for access, entitlement, price, progress totals, scores, rank, semester unlock, issued-document state, and payment state.
- The learner client must never approve semesters, grant paid access, manufacture certificates, or decide that a payment succeeded.
- A push notification is only a delivery channel. The in-app notification record remains the source of truth where an inbox item is requested.
- Sensitive media must use short-lived signed playback/download authorization, not public permanent URLs.
- Existing mobile content target kinds must remain supported: `course`, `lesson`, `test`, `news`, `fact`, `topic`, `interviewQuestion`, `interviewCategory`, `liveClass`, `document`, `exam`, and `section`.
- Existing issued-document statuses must remain supported: `not_issued`, `issued`, `revoked`, `superseded`, and `expired`.
- Existing semester statuses must remain supported: `locked`, `available`, `in_progress`, `requirements_complete`, `pending_review`, `changes_required`, `approved`, and `course_complete`.

---

## 3. Goals and measurable outcomes

### 3.1 Primary goals

- At least 95% of routine content and academic operations can be completed by authorized staff without developer assistance.
- Every high-impact mutation is attributable to an admin, timestamp, reason, and before/after record.
- A content editor can create and publish a basic course, test, banner, or article without direct database access.
- An academic reviewer can move a valid semester submission from pending to approved in under three minutes.
- A teacher can schedule and start a live class from a modern desktop browser.
- Support staff can find a learner and understand access, payments, progress, attempts, documents, and notifications from one profile.
- Bulk operations are previewable, confirmable, recoverable where possible, and rate limited.

### 3.2 Success metrics

- Median content publish time.
- Pending review count and review turnaround time.
- Notification delivery, open, failure, and opt-out rates.
- Live class join success, peak concurrency, attendance, reconnect, and recording availability.
- Test start-to-submit conversion, expiration rate, average score, pass rate, and question difficulty.
- Payment success, verification delay, refund, chargeback, and entitlement-sync rates.
- Certificate issue turnaround and verification scans.
- Admin error rate, rollback count, and support resolution time.

### 3.3 Out of scope for the first production release

- Payroll, HR, staff attendance, physical inventory, and full accounting/ERP.
- A custom video-conferencing protocol or self-built global CDN. Use a supported live-video provider behind an adapter.
- AI-generated final grades or autonomous academic approval.
- Reading or displaying learner passwords, access tokens, payment card numbers, UPI PINs, or provider secrets.
- Arbitrary SQL, unrestricted database consoles, or unaudited impersonation.

---

## 4. Recommended system architecture

### 4.1 Deployable components

1. **Admin Web:** responsive TypeScript web application.
2. **REDI API:** shared backend used by Admin Web and the learner app.
3. **Worker service:** queues for push, email/SMS, scheduled publishing, exports, certificate rendering, media processing, result computation, and webhooks.
4. **Relational database:** authoritative transactional data.
5. **Object storage + CDN:** images, lesson media, project files, document PDFs, recordings, and exports.
6. **Cache/queue store:** rate limits, jobs, distributed locks, idempotency, and short-lived presence.
7. **Realtime gateway:** live chat, moderation events, attendance/presence, and operational updates.
8. **Provider adapters:** live video, payment, push, email, SMS/OTP, storage, and optional analytics.

### 4.2 Recommended implementation baseline

The implementation may use equivalent technologies, but a practical default is:

- Next.js App Router + TypeScript for the admin web app.
- A shared component system with accessible primitives, Tailwind CSS, React Hook Form, and Zod validation.
- TanStack Query for server state and TanStack Table for large operational tables.
- PostgreSQL with a migration-based ORM.
- Redis-compatible queues/cache plus a durable background worker.
- S3-compatible private object storage with signed URLs.
- WebSocket or provider realtime channels for live operational state.
- FCM and APNs behind one notification service.
- A provider adapter for browser live classes. The portal is the control room; the provider carries the audio/video stream.

Do not couple domain logic directly to any one vendor. Define interfaces for `PaymentProvider`, `LiveProvider`, `PushProvider`, `MailProvider`, `SmsProvider`, `StorageProvider`, and `DocumentRenderer`.

### 4.3 Environments

- `local`: seeded development data and provider sandboxes/mocks.
- `development`: shared engineering environment.
- `staging`: production-like configuration and test provider accounts.
- `production`: isolated data, production credentials, backups, alerts, and change controls.

Each environment must have distinct credentials, buckets, webhook secrets, push projects, databases, and domain names. A production admin must not be able to accidentally act on staging and vice versa. Display a persistent non-production environment ribbon.

---

## 5. Admin identity, roles, and permissions

### 5.1 Authentication

- Admin authentication must be separate from learner authentication.
- Require email/password or organization SSO and MFA for all privileged roles.
- Support password reset, recovery codes, session listing, remote sign-out, and forced password/MFA reset.
- Use secure HTTP-only cookies for the web session; do not store admin access tokens in local storage.
- Enforce configurable idle timeout and absolute session lifetime.
- Lock or challenge accounts after suspicious repeated failures.
- Log successful and failed login events with time, coarse location/IP, device/browser, and reason.
- Super Admin and Finance roles SHOULD require phishing-resistant MFA where available.

### 5.2 Default roles

| Role | Purpose | Typical permissions |
|---|---|---|
| Super Admin | Platform owner | All configuration; role management; provider settings; emergency actions |
| Operations Admin | Daily institute operations | Users, enrollments, batches, approvals, notifications, documents, reports |
| Academic Admin | Academic structure and rules | Courses, semesters, tests, results, approvals, certificates |
| Content Editor | Create and maintain content | Draft/edit content, upload media, preview; no final publish unless granted |
| Reviewer/Publisher | Quality approval | Review, approve, schedule, publish, unpublish, rollback |
| Instructor | Assigned teaching work | Assigned courses/batches, live classes, chat, attendance, learner progress |
| Exam Manager | Assessments | Question bank, tests, schedules, results, corrections, result publication |
| Document Officer | Official records | Admit cards, certificate templates, issue/revoke/supersede |
| Support Agent | Learner support | Read learner timeline; resend safe messages; create cases; limited access changes |
| Finance Manager | Commerce | Products, coupons, orders, reconciliation, approved refunds, exports |
| Analyst | Reporting | Read-only dashboards and permitted de-identified exports |
| Auditor | Compliance | Read-only audit, event, permission, and financial history |

### 5.3 Permission model

Use granular permission keys, not hardcoded role-name checks. Examples:

```text
users.read
users.update
users.suspend
users.export
users.impersonate_safe
enrollments.create
enrollments.revoke
content.create
content.edit
content.review
content.publish
content.archive
explore.manage
banners.manage
assessments.author
assessments.publish
results.read
results.recompute
results.override
results.publish
semester.review
semester.approve
documents.generate
documents.issue
documents.revoke
live.schedule
live.host
live.moderate
notifications.send_single
notifications.send_bulk
payments.read
payments.refund_request
payments.refund_approve
settings.manage
admins.manage
audit.read
```

Permissions may be scoped by branch, course, batch, or assigned content. For example, an instructor may host only assigned batches and view only their learners.

### 5.4 Separation of duties

- A content creator SHOULD NOT approve their own high-stakes test or certificate template.
- Result overrides, mass entitlement grants/revocations, certificate revocations, and large bulk notifications require a reason and optionally a second approver.
- Refund requester and refund approver must be different people above a configurable value.
- No admin may edit or delete their own audit records.
- Emergency Super Admin override must require re-authentication and produce a high-severity audit event.

---

## 6. Information architecture and navigation

### 6.1 Main navigation

```text
Dashboard
People
  Learners
  Staff & Roles
  Batches / Cohorts
Learning
  Courses
  Semesters
  Lessons & Resources
  Projects & Reviews
Assessments
  Question Bank
  Tests
  Attempts
  Results
Live Classes
Content
  Explore Sections
  Home Banners
  News
  General Awareness
  Amazing Facts
  Interview Prep
Commerce
  Products & Pricing
  Coupons
  Orders & Payments
  Refunds / Reconciliation
Communications
  Notifications
  Templates
  Delivery Logs
Documents
  Certificates
  Admit Cards
  Templates
Support
Reports
Audit Log
Settings
```

Navigation items must be hidden or disabled based on permission. Direct URLs must also enforce server-side authorization.

### 6.2 Global admin UX requirements

- Desktop-first, fully usable from tablet, with critical review/notification actions usable on mobile web.
- Persistent organization/environment indicator and current admin identity.
- Global search for learner ID/name/phone/email, course, test, order, attempt, document, live class, and notification campaign.
- Breadcrumbs, page title, contextual help, saved filters, visible active filters, sortable/paginated tables, and empty/error/loading states.
- Filter state SHOULD be encoded in the URL so views are shareable between authorized staff.
- All dates show the organization timezone by default and retain UTC internally. Display explicit timezone when scheduling.
- Forms must warn about unsaved changes.
- Destructive actions require a clear impact statement and typed/explicit confirmation proportional to risk.
- Lists must support column selection, export permission checks, and server-side pagination.
- Rich text must be sanitized on input and output. Provide preview matching the learner app as closely as practical.
- Any bulk operation must show estimated audience/affected-record count before execution, then run as a background job with progress and a downloadable failure report.
- Use optimistic UI only for low-risk reversible actions. Approval, finance, scoring, entitlement, and document actions wait for server confirmation.

---

## 7. Admin dashboard requirements

### 7.1 Overview cards

Show permission-aware metrics with comparison period:

- Total, new, active, verified, suspended, and deletion-requested learners.
- Free and paid enrollments; active certification enrollments.
- Live classes today: scheduled, live now, ended, cancelled, failed recording.
- Pending project/semester approvals and age of oldest review.
- Tests active today, attempts in progress, submitted, expired, and results awaiting publication.
- Payments today: initiated, succeeded, access pending, failed, refunded, disputed.
- Certificates/admit cards pending, issued, revoked, and failed generation.
- Notification campaigns scheduled, sending, delivered, failed, and opened.
- Unresolved support cases and breached response targets.

### 7.2 Action queues

Provide actionable lists, not metrics only:

- Reviews awaiting action.
- Payments succeeded but entitlement not granted.
- Certificate/document rendering failures.
- Live classes starting soon with missing host/provider room.
- Tests with invalid question count or unpublished questions.
- Scheduled content/banners that failed to publish.
- Notification campaigns with abnormal failure rate.
- Account deletion/export requests nearing deadline.

### 7.3 Activity and health

- Recent high-impact admin activity.
- Provider/webhook health without revealing credentials.
- Queue backlog and oldest job age.
- API latency/error summary and mobile app version adoption, if telemetry exists.
- Dashboard metrics must link to the underlying filtered list.

---

## 8. Content lifecycle shared by all managed content

### 8.1 Lifecycle states

Unless a module defines stricter states, managed content uses:

```text
draft -> in_review -> approved -> scheduled/published -> unpublished -> archived
                   -> changes_requested -> draft
```

- Draft content is visible only to authorized staff.
- `in_review` freezes or versions the submitted revision.
- A reviewer can approve or request changes with comments.
- Scheduled items publish at an exact UTC timestamp via a durable job.
- Unpublishing removes future discovery but does not corrupt existing learner history.
- Archived records remain referentially intact and cannot be used for new assignments.
- Restore/republish creates a new revision when necessary.

### 8.2 Versioning and preview

- Store version number, author, change note, created time, approval, publish time, and structured before/after diff.
- Allow comparison of any two versions.
- Preview draft content in learner-app proportions and deep-link context without exposing it publicly.
- Published content updates should support immediate publish or scheduled publish.
- Course/test structural edits that would invalidate active enrollments/attempts must be blocked or require creation of a new version.

### 8.3 Media library

- Upload images, PDFs, audio, video, subtitle files, and approved project/document assets.
- Validate extension, detected MIME type, size, duration/dimensions, malware status, and ownership metadata.
- Generate thumbnails/posters and transcode video asynchronously.
- Store alt text, caption, language, rights/source, and expiry if applicable.
- Search by filename, title, tag, uploader, content usage, and date.
- Show every place an asset is used before replacement/deletion.
- Never hard-delete an asset referenced by published content or issued documents.

### 8.4 Localization

- At minimum support English and Hindi metadata where the learner app supports those locales.
- Each localized field has independent draft/completeness status.
- The portal must not claim that untranslated course/test/news bodies are translated.
- Configure default and fallback language per item.

---

## 9. Explore-section management

The current learner app hardcodes Explore sections. This must become API-driven through app configuration while maintaining backward-compatible route targets.

### 9.1 Editable fields

Authorized admins can:

- Create an Explore section from an allowed template/target type.
- Rename title, description, badge, metadata label, and search keywords.
- Change category: `learn`, `prepare`, or `discover`.
- Choose approved icon, clay/color theme, image, and accessibility label.
- Set click target using a validated `ContentRef` or supported catalog-filter target.
- Set optional pricing filter: `all`, `free`, or `paid`.
- Reorder globally and optionally reorder within a category.
- Mark as featured/recommended and set home visibility.
- Set start/end schedule, publish state, audience rules, locale, and minimum supported app version.
- Duplicate, preview, unpublish, and archive.

### 9.2 Stable identity and safe routing

- `id` and `slug` are stable after publication; the display name is freely editable.
- Never store a raw client route name entered by an admin.
- Admin chooses from server-validated targets such as `catalog(course, paid)`, `catalog(exam)`, `news-category:{id}`, `awareness-topic:{id}`, `interview-category:{id}`, or another supported `ContentRef`.
- API maps the target to the mobile client's typed route map.
- If an item requires a newer app version, older clients receive a compatible fallback or the section is excluded.
- A target cannot publish if missing, archived, unauthorized for the selected audience, or unsupported by the configured minimum app version.

### 9.3 Home recommendation behavior

- Configure which sections are eligible for the four home Explore tiles and the full Explore screen.
- Configure mappings from learner focus (`computer`, `exams`, `general`) to a recommended section.
- Personalized ranking rules may affect order, but an admin can pin items above algorithmic results.
- The API returns the final ordered list; the client must not rely on a permanent local array.

### 9.4 Acceptance criteria

- Renaming “Computer Courses” changes the displayed name after app cache refresh without changing the section ID or breaking its destination.
- Reordering sections changes the API order and learner order.
- Hidden or expired sections disappear from new discovery but their underlying content remains accessible to entitled users through valid history/deep links.
- Invalid targets cannot be published.
- All publish, order, rename, hide, and target changes are audited.

---

## 10. Home banners and app configuration

### 10.1 Banner management

Admins with `banners.manage` can create:

- Hero banners, compact announcement banners, live-class banners, and optional modal announcements.
- Responsive artwork for supported placements, with preview and safe-area guidance.
- Title, subtitle, CTA label, background/theme, alt text, locale, and internal campaign name.
- Validated target: content reference, Explore section, filtered catalog, live class, document, support/legal page, or approved HTTPS external link.
- Audience: everyone, guests, authenticated learners, selected users, batch, course enrollment, entitlement, city, language, activity, or saved segment.
- Start/end date, timezone, priority, placement, frequency cap, dismissal behavior, and fallback.
- Draft/review/schedule/publish/pause/archive state.

### 10.2 Banner behavior

- Multiple eligible banners resolve deterministically by placement, priority, audience, and schedule.
- Expired, unpublished, unsupported, or unauthorized banners are not returned.
- Admin preview shows desktop portal preview plus representative phone sizes.
- Track impression, click, dismissal, target-open success, and conversion event where applicable.
- External links show an external-link indicator and use an allowlist. Never allow `javascript:` or unsafe schemes.
- Banner failures must not prevent Home or Explore from loading.

### 10.3 App configuration

Manage versioned, validated configuration for:

- Support contact details and operating hours.
- Privacy/terms document revisions.
- Feature flags and provider capability flags.
- Minimum/recommended app versions and maintenance notices.
- Allowed upload types/sizes and download policy.
- Learner-facing labels that are explicitly designed to be remote-configurable.

Feature flags must have type, default, environment, owner, description, rollout rule, start/end, and audit history. Secrets are never stored as feature-flag values.

---

## 11. Learner, batch, and enrollment management

### 11.1 Learner list

Search/filter by:

- Internal learner ID, name, normalized phone, email, city, verification state, account state, source, registration range, last active range, and app version.
- Course, batch, enrollment state, entitlement, payment state, semester state, certificate state, test participation, and risk/support tag.
- Saved filters and permission-aware exports.

Default list columns include learner identity, masked contact, verification, account state, active enrollments, latest activity, outstanding action, and created date. Personally identifying columns are permission controlled and access logged.

### 11.2 Learner profile workspace

One profile must provide tabs for:

1. **Overview:** identity, verified contacts, account state, interests, city, registration source, latest activity, and internal notes.
2. **Enrollments:** course, batch, entitlement source, progress, semester status, access start/end, and revoke/grant history.
3. **Learning:** lesson completion, resume point, resources/download authorizations, and progress timeline.
4. **Assessments:** attempts, answers where authorized, result, rank, publication state, and irregularity flags.
5. **Projects & reviews:** submissions, files, feedback, resubmissions, reviewer, and decision history.
6. **Payments:** orders, provider references, quote, coupon, amount, verification, access state, refund/dispute.
7. **Documents:** admit cards, certificates, issue/revoke/supersede state, and verification events.
8. **Notifications:** inbox records, push delivery, open state, target, and preferences.
9. **Live attendance:** registrations/reminders, joins, duration, chat/moderation events, and recording access.
10. **Support & audit:** support cases, safe admin actions, data requests, consent/terms revision, and account history.

### 11.3 Learner actions

Subject to permission and policy:

- Correct approved profile fields; verify or unverify a contact only with evidence and reason.
- Suspend, reactivate, or schedule deactivation; show effect on sessions and access before confirmation.
- Revoke active sessions.
- Add/remove internal tags and notes that are never shown to the learner.
- Assign to or remove from a batch.
- Grant a free/manual/scholarship entitlement with reason, scope, start/end, and approval.
- Revoke future access with reason without deleting learning history.
- Resend verification, password-reset, class, document, or result messages through approved templates.
- Start a privacy export or process an account deletion request.
- Use safe impersonation only if enabled: read-only by default, prominent banner, no password/payment/MFA changes, no taking tests, no sending messages as learner, and full audit.

Admins cannot view passwords, OTPs, refresh tokens, full payment credentials, or private provider tokens.

### 11.4 Account states

```text
pending_verification -> active -> suspended -> active
                                -> deletion_requested -> deleted/anonymized
                                -> blocked
```

- Deleted/anonymized accounts retain legally required financial and academic records with minimized identity.
- Suspension immediately revokes sessions and blocks protected actions but does not silently erase entitlements or results.
- Every state change requires a reason and notification policy.

### 11.5 Batches/cohorts

- Create batch with code, name, course, start/end, timezone, capacity, instructors, status, tags, and optional branch.
- Add learners individually, by validated CSV, enrollment rule, or approved bulk action.
- Move learners while preserving attendance and academic history.
- Assign live classes, tests, announcements, and certificate rules to a batch.
- Show capacity, enrollment, activity, progress, review backlog, performance, and completion.

---

## 12. Course, semester, lesson, and resource management

### 12.1 Course fields

- Stable ID and editable slug.
- Title, short title, summary, full description, outcomes, prerequisites, language, level, tags, category, icon/theme, cover image, preview media, and SEO/share metadata if public web pages exist.
- Delivery type: standard course or semester certification track.
- Commercial mode: free, paid, included, invite-only, or hidden/internal.
- Product association, access duration, enrollment window, visibility, featured status, instructors, support contact, and estimated duration.
- Rating/learner-count display must be derived or clearly marked as editorial; never fabricate operational statistics.
- Draft/review/publish schedule and revision notes.

### 12.2 Curriculum builder

- Drag/reorder modules, semesters, lessons, tests, projects, and resources.
- Lesson fields: title, index/order, description, duration, content type, playback/media asset, notes, captions, transcript, preview flag, completion rule, and download policy.
- Resource fields: title, kind (`pdf`, `video`, `notes`, `audio`, `other`), asset, MIME, size, download policy, and access rule.
- Validate duplicate order, missing media, inaccessible referenced tests/projects, unsupported files, and empty required fields.
- Preview as guest, unenrolled authenticated learner, enrolled learner, and completed learner.

### 12.3 Course change safety

- Do not replace IDs of lessons that have learner progress.
- Reordering published lessons updates display order but does not rewrite historical completion.
- Removing a lesson from a published curriculum archives it for new learners and defines how existing learners see it.
- Changing completion rules after enrollments exist requires an impact preview and versioned migration policy.
- A paid product cannot publish without a valid product/entitlement configuration.
- Course unpublish must not revoke already purchased access unless an explicit, separately authorized entitlement action is performed.

### 12.4 Semester configuration

For each semester configure:

- Index, title, description, expected duration, lessons, required tests, required projects, and minimum completion.
- Minimum test score/grade, attempt handling, project acceptance requirement, and manual-review requirement.
- Review submission rule: automatic when requirements complete or learner-triggered `submit-review`.
- Next-semester unlock rule: admin approval, fixed date, all requirements, or a supported combination.
- Estimated review SLA and learner-facing locked/pending/changes-required messages.
- Certificate contribution/completion rule.

Progress, test score, project acceptance, and admin approval must remain separate facts. Video completion alone cannot imply approval.

### 12.5 Progress and completion administration

- Staff can inspect calculated course and semester progress and its components.
- Manual completion correction is exceptional, permission controlled, reason required, and audited.
- Recalculation runs in a background job, is idempotent, and reports affected records.
- Never reset progress as a side effect of ordinary curriculum editing.
- Support one-learner and scoped bulk recalculation with dry-run impact.

---

## 13. Projects, submissions, and academic approval

### 13.1 Project authoring

- Title, instructions, rubric, allowed text/file submission modes, file types/sizes/count, due window, late policy, maximum submissions, and passing/acceptance conditions.
- Project may belong to a course/semester and may block review submission.
- Draft changes must not mutate the rubric used for already-reviewed submissions; preserve rubric version.

### 13.2 Submission queue

Filter by course, semester, batch, learner, project, status, age, due state, assigned reviewer, and resubmission count.

Each review screen shows:

- Learner and enrollment context.
- Submitted text and safe file preview/download.
- Malware-scan state and immutable original upload metadata.
- Rubric criteria and scoring/comments.
- Prior submissions, decisions, and feedback.
- Related lesson/test completion.
- Reviewer notes (internal) and learner-visible feedback (separate fields).

### 13.3 Project decisions

```text
not_started -> draft -> submitted -> accepted
                            |-> changes_required -> draft/resubmitted
```

- `accepted` and `changes_required` require feedback; policy may require criterion scores.
- Upload success never means academic acceptance.
- A revised submission is a new immutable revision linked to its predecessor.
- Reopening an accepted submission requires elevated permission and a reason.
- Decision sends an inbox notification and optional push according to learner preferences.

### 13.4 Semester review queue

When requirements are satisfied, a review record is created or submitted. Reviewer sees a server-calculated checklist:

- Required lessons complete.
- Required tests submitted/passed.
- Projects submitted/accepted.
- Payment/entitlement valid where relevant.
- Identity/document requirements satisfied if configured.
- Any integrity/support flags.

Available decisions:

- **Approve:** mark semester approved and atomically unlock the next allowed semester or complete the course.
- **Request changes:** set `changes_required`, provide structured reasons and learner feedback, and define resubmission eligibility.
- **Reject/close:** only if institute policy supports a terminal rejection; requires elevated permission.
- **Reassign/escalate:** change reviewer or seek a second opinion without changing academic state.

Approval must be an idempotent transaction. Duplicate clicks/webhooks cannot unlock twice. A notification signals the learner app to refetch; it is not itself the unlock authority.

---

## 14. Assessment and question-bank management

### 14.1 Compatibility rule

The current learner app supports single-choice questions with option IDs. Phase 1 production tests MUST therefore use `single_choice`. The data model may prepare for `multiple_choice`, `true_false`, `numeric`, `short_text`, and `essay`, but these types cannot be published to mobile until the learner UI, answer API, scoring, and result review support them.

### 14.2 Question bank

Question fields:

- Stable ID and revision.
- Question type and prompt (sanitized rich text).
- Optional image/media, helper text, passage/case-study group, language, and accessibility description.
- Subject, exam, course, section, topic, subtopic, skill, difficulty, tags, author, and source/rights.
- Options with stable option IDs, display order, label/media, and exactly one correct option for `single_choice`.
- Explanation/solution, reference link, marks, negative marks, expected time, and status.
- Usage count, live-test usage, quality flags, item-analysis statistics, and last-reviewed date.

Requirements:

- Add manually, duplicate, import from a validated template, and export where permitted.
- Import provides a dry run with row-level errors and never partially publishes invalid questions.
- Detect likely duplicates without blocking legitimate variants.
- Randomize option display only if configured; correct answer is tied to option ID, never array position.
- Once used in a started attempt, preserve the exact question revision and option order snapshot.
- Retiring a question prevents new use but preserves historical attempts/results.
- Explanations and correct answers are never included in formal attempt payloads before allowed release.

### 14.3 Test builder

Test fields and rules:

- Stable ID, title, description, exam/course/semester relationships, mode (`practice` or `formal`), language, instructions, and tags.
- Question selection: fixed ordered list, randomized pool rules, or supported section pools.
- Question count, section count, marks/max score, duration, availability window, timezone, and grace policy.
- Attempt limit, eligibility, batch/audience, resume policy, late-start policy, and submit-on-expiry behavior.
- Positive/negative/partial marking rules, pass threshold, sectional cutoff, tie-breaking, rank population, and normalization if explicitly required.
- Pricing/access: free, entitled, paid product, invite-only.
- Navigation: free movement, one-way, mark for review, per-section timing, optional question shuffle, and option shuffle.
- Result policy: immediate, after end time, after manual publish, score-only, solutions time, and answer-explanation release.
- Integrity settings: focus/exit telemetry, device/session limits, randomized variants, IP/device flags, and clear privacy notice. Do not claim secure proctoring without a real provider.

### 14.4 Test validation before publish

Block publication when:

- Active question count differs from configured count.
- A question lacks valid options/correct answer/marks.
- Total/section marks do not reconcile.
- Schedule or timezone is invalid.
- Result release precedes test close when not explicitly allowed.
- Paid access lacks a valid product.
- Selected question type is unsupported by the target mobile version.
- A fixed question was archived or its revision is not approved.
- Pool rules cannot generate the required number of unique questions.

Show a generated test preview and a calculation summary before final approval.

### 14.5 Attempt lifecycle and operations

```text
created/in_progress -> submitted -> scored -> result_unpublished -> result_published
                  |-> expired
                  |-> abandoned
```

- Attempt creation returns authoritative `expiresAt`, revision, question snapshot, and option IDs.
- Answer saves use optimistic-concurrency revision checks.
- Formal tests do not reveal correctness while active.
- Submission is atomic and idempotent; duplicate submit returns the same result.
- An admin can inspect save history, timing, device/session metadata, errors, and flags without changing answers.
- Resume, extra time, invalidate, reopen, or terminate are explicit permissioned actions with reason and learner notification.
- Never edit a learner's submitted answer. If policy requires correction, invalidate/re-score against a corrected key while preserving both versions.

### 14.6 Scoring and results

- Scoring runs server-side against the immutable test/question/marking snapshot.
- Store raw score, max score, percentage, pass/fail, accuracy, time, section scores, skipped/correct/wrong counts, and scoring version.
- Ranking defines eligible population, ties, excluded/invalid attempts, and recalculation time.
- Result UI must show whether solutions are available based on policy.
- Result publication can target one test window/batch and must show affected learner count.
- Result correction creates a new result revision; old result stays in audit history.
- Recompute provides dry run, delta distribution, impacted pass/fail changes, and confirmation.
- Direct result override is a last resort: require elevated permission, reason, evidence/attachment, old/new values, and second approval when configured.
- Publication and correction send deduplicated notifications.

### 14.7 Assessment analytics

- Participation, completion, expiration, score distribution, pass rate, average/median, percentile, section performance, and time distribution.
- Question difficulty, discrimination, distractor selection, skip rate, average time, and possible ambiguity flags.
- Compare batches/windows while respecting minimum cohort size for privacy.
- Export results and response-level data only with explicit permissions.

---

## 15. Live-class control center

### 15.1 Principle

The admin portal must allow an authorized host to conduct a class in the browser, but media transport should be provided by a reliable live-video provider adapter. REDI owns scheduling, authorization, attendance, chat records, moderation, notifications, and recording metadata.

### 15.2 Create/schedule live class

Fields:

- Title, description/agenda, course, lesson, batch/audience, instructor(s), moderator(s), locale, and tags.
- Start/end date and organization timezone, early-join window, capacity, and optional recurrence.
- Class type: interactive room, webinar/broadcast, or recording premiere if supported.
- Learner permissions: camera, microphone, chat, reactions, hand raise, screen share, and Q&A.
- Recording policy, attendance threshold, reminder schedule, waiting-room message, cover/poster, resources, and replay availability.
- Provider/room profile selected through safe configuration; no provider secret displayed.

Validate host assignment conflicts, course/audience access, provider capacity, start/end times, and recording consent copy.

### 15.3 Live-class states

```text
draft -> scheduled -> starting -> live -> ended -> processing_recording -> recording_available
                     |-> cancelled
                     |-> failed
live -> reconnecting -> live/ended
```

State transitions are server-controlled and reconciled with signed provider webhooks. Webhooks must be idempotent and resistant to replay.

### 15.4 Host classroom

The browser host experience must provide:

- Preflight camera, microphone, speaker, screen-share, browser permission, and network check.
- Start class, end for all, mute participant, remove participant, admit from waiting room, promote co-host/presenter, and lock room.
- Share screen, upload/show approved resources, optional polls if provider supports them, and recording indicator.
- Participant list with join state, connection quality, hand raise, mute state, and attendance duration.
- Moderated chat with slow mode, delete/hide, disable chat, pin announcement, and block abusive participant.
- Hand-raise queue. Raising a hand never grants microphone automatically.
- Realtime viewer count derived from presence, not an editorial number.
- Prominent provider/reconnection status and safe recovery controls.
- Instructor and moderator action audit.

### 15.5 Learner join and access

- `POST /live-classes/{id}/join` rechecks authentication, entitlement/batch assignment, class state, capacity, and ban status.
- Return a short-lived participant token/playback URL with least privilege.
- Scheduled/cancelled/ended/unauthorized learners see explicit state, not a fake classroom.
- Reminders are per learner and class.
- Join tokens are not stored in analytics or admin-visible logs.

### 15.6 Attendance, recording, and after-class workflow

- Record first join, last leave, total connected duration, reconnect count, device category, and attendance status.
- Allow authorized staff to correct attendance with reason while preserving measured data.
- Provider recording webhook creates a processing record; scan/transcode/poster/captions run asynchronously.
- Admin reviews and publishes recording availability, audience, expiry, and download policy.
- Ended class with no approved recording must not advertise “Watch recording.”
- Cancellation requires a reason and audience notification option.
- Provide attendance, engagement, chat moderation, join failure, and recording reports.

### 15.7 Failure handling

- If host disconnects, maintain the room for a configured grace period and allow an assigned co-host to continue.
- If provider room creation fails, show the class in an actionable error queue and prevent false “live” status.
- Class end and recording webhooks are idempotent.
- Provide a manual reconciliation action that reads provider state without fabricating it.

---

## 16. Editorial content management

### 16.1 News

- Manage news categories and articles.
- Article fields: title, slug, byline, published/source date, excerpt, structured body, highlights, tags, featured flag, reading-time override, image/alt text, source/rights, locale, and access policy.
- Schedule and expire an article; pin/feature within a category.
- Preview cards and full article.
- Premium bodies are returned only after server access authorization; a hidden client field is not access control.
- Sharing uses approved metadata and an actual public URL only if the organization provides one.

### 16.2 General awareness

Manage topics with schema:

- `pairs`: label/value records such as State/Capital.
- `list`: ordered entries.
- `article`: structured long-form body.

Fields include title, summary, chips, entries, group, icon/color, image, access, locale, keywords, and order. Searchable pair content must index both label and value. Validate schema-specific required fields before publication.

### 16.3 Amazing facts

- Manage fact categories and individual facts.
- Fact fields: text, explanation, category, image, featured flag, source/rights, locale, tags, and optional published quiz ID.
- Reaction counts are system-derived. Admin may moderate suspicious data but cannot casually type a marketing count.
- “Take a Quiz” appears only when a valid, published, accessible test is linked.

### 16.4 Interview preparation

- Manage interview categories, question order, prompt, model answer, tips, tags, role/industry, level, locale, and access.
- Configure product CTA items such as 1-on-1 interview preparation with a valid product and honest fulfillment details.
- Do not present a manual service as an AI interviewer or calendar booking unless those systems actually exist.

### 16.5 Search administration

- Published entities are indexed asynchronously with index status and retry action.
- Admin can configure synonyms, curated results, hidden terms, and safe no-result suggestions.
- Search ranking changes are versioned and previewable.
- Never log raw sensitive search queries indefinitely; apply retention and redaction policy.

---

## 17. Notification and communication center

### 17.1 Supported sends

Authorized staff can send to:

- One specific learner.
- A manually selected set of learners.
- One or more batches/courses/enrollment states.
- A saved dynamic segment.
- All eligible authenticated learners.
- Optionally guests/devices only when consent and token model support it.

Channels:

- In-app inbox.
- Push through FCM/APNs.
- Optional email and SMS through configured adapters.

Channel selection must respect purpose, learner preferences, consent, quiet hours, provider readiness, and legally mandatory exceptions.

### 17.2 Notification composer

Fields:

- Internal campaign name, category, purpose/transactional classification, title, body, image, locale, and template.
- Validated target `ContentRef` or safe approved URL.
- Channel(s), audience definition, exclusions, schedule/timezone, quiet-hour behavior, expiry, priority, and deduplication key.
- Optional action button and fallback behavior when target is unavailable.

Current mobile inbox categories `classes`, `tests`, and `news` must remain supported. Extend categories in a backward-compatible manner for payments, documents, courses, support, and promotions.

### 17.3 Audience and send safety

- Show estimated recipients by channel before send.
- Allow a test send to the current admin or whitelisted test account.
- Show representative phone/inbox preview and variable substitution preview.
- Validate required variables for every locale.
- Sending to all users requires `notifications.send_bulk`, re-authentication, explicit confirmation, reason, and optional second approval.
- Large sends execute through a rate-controlled queue; never synchronously in a web request.
- Idempotency prevents duplicated campaigns and per-user messages.
- Exclude invalid tokens, suspended/deleted accounts, opted-out promotional users, and audience members who lost eligibility before execution.

### 17.4 Notification states

```text
draft -> in_review -> approved -> scheduled -> preparing -> sending -> sent/completed
                                        |-> paused -> sending
                                        |-> cancelled
                                        |-> failed/partial
```

Per-recipient delivery states include `queued`, `sent_to_provider`, `delivered` where supported, `failed`, `opened`, and `target_opened`. Inbox record states include unread/read/archived.

### 17.5 Templates and automation

- Versioned templates for class reminders, class cancellation, project feedback, semester approval, test result, certificate issue, payment success/failure, support updates, and security alerts.
- Variables are allowlisted, typed, and escaped.
- Event-triggered automation has event, conditions, delay, frequency cap, channels, template revision, owner, enabled flag, and audit trail.
- A template update does not rewrite previously sent messages.

### 17.6 Delivery and analytics

- Campaign dashboard: audience count, excluded count/reasons, queued, provider accepted, delivered, failed by reason, opened, target opened, unsubscribed, and invalid tokens.
- Drill down to a specific learner only with appropriate permission.
- Retry transient failures with backoff; do not retry permanent invalid tokens.
- Inbox is authoritative for in-app records. A successful push receipt does not mean the learner read it.
- Retain delivery logs according to policy and avoid storing provider secrets/payloads containing unnecessary PII.

### 17.7 Single-user notification acceptance criteria

- An admin can find one learner, compose or choose a template, preview, send, and see the inbox record and channel delivery state.
- Another learner cannot receive the message due to a broad-query mistake; recipient ID is explicit in the confirmation.
- Clicking a valid target marks the notification read and opens the correct authorized destination.

---

## 18. Certificates and admit cards

### 18.1 Document templates

Support versioned templates for certificate and admit card with:

- Organization identity, authorized logo/seal, background, typography, page size/orientation, signature blocks, and QR position.
- Typed variables such as learner name, course, batch, roll/registration number, result/grade, issue date, exam venue/date, and document serial.
- Locale, applicability rules, effective dates, and approval status.
- Browser preview plus server-rendered PDF preview using sample and real authorized data.
- Template validation for overflow, missing variables, invalid signatures/assets, and inaccessible QR.

Published templates are immutable. Editing creates a new version; old issued documents retain the original rendered file and template version.

### 18.2 Eligibility and generation

Certificate eligibility may require:

- Active/valid enrollment and entitlement.
- Course/semester completion.
- Required projects accepted.
- Required tests passed and results published.
- Identity/profile fields complete.
- No unresolved academic/financial hold where policy lawfully permits.
- Academic/admin approval.

Generation flow:

```text
not_eligible -> eligible -> generation_pending -> generated -> approval_pending -> issued
                                |-> generation_failed
issued -> superseded
issued -> revoked
issued -> expired (only document types with expiry)
```

- Generate one or bulk by course/batch with a dry-run eligibility report.
- Assign collision-resistant document ID and human-readable serial under transactional control.
- Render and hash an immutable PDF; store template version and source data snapshot.
- QR contains an official opaque verification URL/token, never learner-private data.
- Generation does not equal issuance. An authorized officer must review/approve unless an explicitly approved auto-issue policy applies.

### 18.3 Issuance, verification, revocation

- Issue immediately or schedule; create the learner document record and optional notification atomically/idempotently.
- Public verification endpoint returns minimum necessary facts: valid/invalid, document type, masked or policy-approved identity, course/title, issue date, issuer, and status.
- Verification must not expose phone, email, address, scores, or private files unless expressly required.
- Revoke with standardized reason plus internal note; notify learner according to policy.
- Reissue creates a new document and marks old one `superseded`; never overwrite the original PDF.
- Every view/download/verification may be counted with privacy controls.
- A revoked/not-issued document must never display a “verified” badge.

### 18.4 Admit cards

- Configure exam/test window, venue or online instructions, reporting time, candidate/roll number, permitted/prohibited items, and contact.
- Issue only to eligible candidates.
- Changes after issue require new version/reissue and notification.
- Admit card is read-only in the learner app and obtained through authorized PDF download.

---

## 19. Products, pricing, payments, coupons, and entitlements

### 19.1 Products and offers

- Product fields: stable ID, title, description, course/service mapping, provider/store product IDs, currency, list price, sale price/rule, tax metadata, access duration, enrollment limits, and status.
- Prices use integer minor units and ISO currency.
- Product publication validates course/access mapping and provider configuration.
- Never merge the free Tally Prime offering and the paid Tally certification offering because titles look similar; they are distinct stable products/courses.

### 19.2 Coupons

- Code, name, active window, discount type/value, min order, max discount, total/per-user limit, eligible products/audiences, first-purchase rule, stack policy, and status.
- Quote service calculates authoritative totals and coupon outcome.
- Track redemptions idempotently against succeeded policy, not only button clicks.
- Admin UI shows expected calculation examples before activation.

### 19.3 Orders and payment operations

Order detail must show:

- Order ID, learner, product, immutable quote, coupon, amount/currency, method, timestamps, idempotency key fingerprint, and state history.
- Provider order/payment references, webhook events, verification attempts, receipt, entitlement outcome, refund/dispute, and related audit events.
- Secrets and full payment credentials are never displayed.

Preserve states used by the learner experience:

```text
idle -> creatingOrder -> awaitingProvider -> verifying
     -> paidAccessPending -> succeeded
     -> cancelled | failed | unknownNeedsRecheck
```

- Client/provider claims are not enough; backend verification is authoritative.
- `paidAccessPending` is an incident to reconcile, not a reason to charge again.
- Manual “mark paid” is disabled by default. If business policy requires it, use a separate audited offline-payment workflow with evidence and approval.
- Reconciliation compares provider settlement/webhooks, REDI order state, and entitlement state.

### 19.4 Refunds and disputes

- Refund request includes amount, reason, policy evidence, original payment, entitlement impact, requester, and approval.
- Provider response/webhook determines actual refund state.
- Partial/full refunds and entitlement policy are explicit; revoking access is not silently assumed.
- Chargebacks/disputes create alerts and a case timeline.
- Financial exports are restricted and watermarked/logged.

### 19.5 Entitlements

- Entitlement fields: learner, product, resource/course scope, source (`purchase`, `manual`, `scholarship`, `promotion`, `migration`), state, starts/ends, order/reference, grant/revoke reason, and audit.
- Grant/revoke is idempotent and separately permissioned from content editing.
- Ordinary content unpublish does not erase entitlement history.
- Every access decision API returns `granted/denied`, reason, optional product, expiry, preview, and download rights.

---

## 20. Downloads, uploads, and file governance

- Admin can view metadata and operational state of learner downloads without accessing private device files.
- Protected download uses short-lived authorization, entitlement recheck, optional device/license policy, and audit.
- Configure file size/type/count per avatar, project, content resource, and document use case.
- Upload flow: create upload authorization, validate server-side completion, malware scan, metadata extraction, and attach to domain record.
- Unscanned/quarantined uploads cannot be previewed by normal admins or served to learners.
- Project-file download is logged and limited to assigned reviewers/authorized staff.
- Provide retention policies for rejected drafts, project submissions, exports, recordings, and issued documents.
- Deleting a database reference does not immediately destroy an object subject to retention/legal hold.

---

## 21. Support, feedback, legal, and account requests

### 21.1 Support content

- Manage FAQ categories/questions, public email/phone, operating hours, escalation message, and maintenance notices.
- Manage versioned Privacy Policy, Terms, refund policy, and other legal pages with effective date and locale.
- Store learner acceptance of legally required revisions when applicable.

### 21.2 Support cases

- Create from learner feedback/contact or manually.
- Case fields: ID, learner, category, priority, status, subject, messages, attachments, assignee, SLA, related course/test/order/document, tags, and internal notes.
- Separate learner-visible response from internal note.
- Support agents can link but not silently alter academic/payment records.
- Escalate to academic, finance, document, or technical queue.
- Close with resolution code and optionally request feedback.

### 21.3 Privacy and deletion requests

- Track request, identity verification, statutory deadline, scope, holds, export, approval, execution, and completion communication.
- Deletion/anonymization runs as an auditable background workflow.
- Retain only records legally/contractually required and minimize identity.
- Never promise deletion completion merely because the mobile user tapped a request button.

---

## 22. Reports and analytics

### 22.1 Standard reports

- Learner acquisition, verification, activity, retention, and course engagement.
- Enrollment and entitlement by course/product/source/batch/date.
- Course progress, lesson completion/drop-off, resource use, and completion time.
- Semester requirements, approval turnaround, rejection/rework, and backlog aging.
- Test participation, result distribution, pass rate, rank, section/question analytics, and attempt anomalies.
- Live-class schedule, attendance, watch duration, engagement, join failures, and recordings.
- Revenue/order status, coupon use, verification delay, refund, dispute, and reconciliation.
- Notification volume, delivery, open, target-open, failure, and opt-out.
- Certificate/admit-card eligibility, issuance, failure, revocation, and verification.
- Support volume, response/resolution time, SLA breaches, and category.

### 22.2 Report behavior

- Use server-side filtering, pagination, and aggregation.
- Every metric defines numerator, denominator, timezone, exclusion rules, and data freshness.
- Dashboards show “last updated” and partial-data warnings.
- Exports run asynchronously, expire, are encrypted at rest, and use signed download URLs.
- Export rows and PII are permission controlled; all exports are audited.
- Apply spreadsheet-injection protection to CSV values.
- Large or recurring reports require saved-report permission and recipient allowlist.
- Minimum cohort thresholds should hide sensitive small-group analytics.

### 22.3 Event taxonomy

Use consistent names and versioned properties, for example:

```text
learner_registered
learner_verified
course_viewed
enrollment_created
lesson_started
lesson_completed
test_started
test_submitted
result_published
project_submitted
semester_approved
live_join_succeeded
live_join_failed
notification_opened
order_succeeded
entitlement_granted
document_issued
document_verified
```

Analytics events never replace transactional records. Do not put passwords, OTPs, tokens, full message bodies, submitted answers, or unnecessary PII in analytics.

---

## 23. Audit log and operational history

### 23.1 Events to audit

At minimum:

- Admin login/logout/failure, MFA and session changes.
- Role, permission, staff account, and organization-setting changes.
- Learner profile/account/session/entitlement changes and safe impersonation.
- Content create/edit/review/publish/unpublish/archive/restore.
- Explore order/label/target changes and banner/config changes.
- Question/test/marking/schedule/result changes.
- Project and semester decisions.
- Live schedule/host/moderation/recording actions.
- Notification audience/template/send/cancel actions.
- Product/coupon/order/refund/reconciliation actions.
- Certificate/admit-card template/generate/issue/revoke/reissue.
- Export and sensitive-record view/download.
- Provider setting, webhook reconciliation, and feature-flag changes.

### 23.2 Audit record shape

```text
id
occurredAtUtc
actorType / actorId / actorDisplay
sessionId / requestId / correlationId
action
resourceType / resourceId
scope
before (redacted structured snapshot or diff)
after (redacted structured snapshot or diff)
reason
approvalId (optional)
ip / userAgent (subject to retention policy)
outcome / errorCode
severity
```

- Audit records are append-only and tamper evident.
- Redact passwords, tokens, provider secrets, full financial credentials, OTPs, and sensitive file URLs.
- Search/filter by actor, action, resource, date, severity, and request ID.
- Retention and export follow policy. No UI or API offers ordinary delete/edit for audit entries.

---

## 24. Core data model

Exact names may vary, but the backend must represent these concepts explicitly rather than hiding them in unvalidated JSON.

### 24.1 Identity and authorization

- `AdminUser`, `AdminSession`, `MfaMethod`, `Role`, `Permission`, `RolePermission`, `AdminRole`, `ScopeAssignment`.
- `Learner`, `LearnerContact`, `LearnerSession`, `Device`, `NotificationPreference`, `Consent`, `AccountAction`.
- `Batch`, `BatchMembership`, `InstructorAssignment`.

### 24.2 Content and learning

- `ExploreSection`, `ExploreSectionVersion`, `Banner`, `BannerVersion`, `AudienceRule`.
- `Course`, `CourseVersion`, `Module`, `SemesterDefinition`, `Lesson`, `LessonVersion`, `Resource`, `MediaAsset`.
- `Enrollment`, `Entitlement`, `LessonProgress`, `Bookmark`, `DownloadAuthorization`.
- `Project`, `ProjectRubricVersion`, `ProjectSubmission`, `ProjectReview`, `SemesterProgress`, `SemesterReview`.
- `NewsCategory`, `NewsArticle`, `AwarenessTopic`, `AwarenessEntry`, `FactCategory`, `Fact`, `FactReaction`, `InterviewCategory`, `InterviewQuestion`.

### 24.3 Assessments

- `Question`, `QuestionRevision`, `QuestionOptionRevision`, `QuestionTag`.
- `Test`, `TestVersion`, `TestSection`, `TestQuestion`, `TestPoolRule`, `TestWindow`, `TestAssignment`.
- `Attempt`, `AttemptQuestionSnapshot`, `AttemptAnswerRevision`, `AttemptEvent`.
- `Result`, `ResultRevision`, `ResultSection`, `ResultQuestion`, `RankRun`, `IntegrityFlag`.

### 24.4 Operations

- `LiveClass`, `LiveRoom`, `LiveParticipant`, `AttendanceSession`, `LiveChatMessage`, `ModerationAction`, `Recording`.
- `NotificationCampaign`, `NotificationTemplateVersion`, `NotificationRecipient`, `InboxNotification`, `PushDelivery`.
- `Product`, `Price`, `Coupon`, `CouponRedemption`, `Order`, `Payment`, `PaymentEvent`, `Refund`, `Entitlement`.
- `DocumentTemplate`, `DocumentTemplateVersion`, `DocumentEligibility`, `IssuedDocument`, `DocumentVerificationEvent`.
- `SupportCase`, `SupportMessage`, `LegalDocumentVersion`, `PrivacyRequest`.
- `AuditEvent`, `ApprovalRequest`, `BackgroundJob`, `WebhookEvent`, `ExportJob`, `FeatureFlag`.

### 24.5 General database rules

- Use UUID/ULID-style non-guessable primary identifiers; optional human-readable codes are separate unique fields.
- Store `createdAt`, `updatedAt`, creator/updater where appropriate, and a concurrency/version field for editable critical records.
- Use UTC timestamps plus explicit source timezone for scheduled display.
- Use soft archive/status for referenced business records; hard deletion is restricted to safe unreferenced drafts or retention jobs.
- Enforce foreign keys, unique constraints, check constraints, and transactional state transitions.
- Money is integer minor amount plus currency.
- Normalize phones for matching but display masked/approved formatting.
- JSON may store controlled provider payload fragments or flexible presentation metadata, not core authorization/scoring state.

---

## 25. API requirements

### 25.1 API conventions

- Versioned API prefix, e.g. `/v1`; document with OpenAPI.
- JSON success resources and consistent error envelope:

```json
{
  "code": "SEMESTER_REVIEW_CONFLICT",
  "message": "This semester was already reviewed.",
  "fieldErrors": {"feedback": ["Feedback is required."]},
  "requestId": "req_..."
}
```

- Cursor pagination: `{ "items": [], "nextCursor": null, "total": 0 }` where total is affordable/useful.
- Server-side filtering/sorting with allowlisted fields.
- Optimistic concurrency using revision/ETag for high-conflict edits.
- `Idempotency-Key` for create order, bulk jobs, result publish, semester approval, document issue, notification send, and other retryable commands.
- `requestId`/correlation ID returned and propagated through jobs/webhooks.
- Rate-limit metadata and `Retry-After` for 429.
- Do not blindly retry non-idempotent commands.

### 25.2 Learner API compatibility

The backend must implement or reconcile the learner contracts already proposed in this repository, including:

```text
POST   /auth/login
POST   /auth/register
POST   /auth/challenges/{id}/verify
POST   /auth/password/forgot
POST   /auth/password/verify
POST   /auth/password/reset
POST   /auth/google/exchange
POST   /auth/refresh
POST   /auth/logout

GET    /me
PATCH  /me
GET    /home
GET    /categories
GET    /search
GET    /courses/{id}
POST   /courses/{id}/enroll
GET    /courses/{id}/lessons
GET    /lessons/{id}
POST   /lessons/{id}/progress
POST   /lessons/{id}/complete

GET    /tests
GET    /tests/{id}
POST   /tests/{id}/attempts
GET    /attempts/{id}
PUT    /attempts/{id}/answers/{questionId}
POST   /attempts/{id}/submit
GET    /attempts/{id}/result
GET    /me/attempts

GET    /me/enrollments
GET    /enrollments/{id}/semesters
GET    /enrollments/{id}/semesters/{semesterId}
POST   /enrollments/{id}/semesters/{semesterId}/submit-review
GET    /projects/{id}
POST   /projects/{id}/submissions

GET    /live-classes
GET    /live-classes/{id}
POST   /live-classes/{id}/join
PUT    /live-classes/{id}/hand
PUT    /live-classes/{id}/reminder
GET    /live-classes/{id}/chat
POST   /live-classes/{id}/chat

POST   /checkout/quote
POST   /orders
GET    /orders/{id}
POST   /payments/verify
GET    /me/orders
GET    /me/entitlements

GET    /me/notifications
PATCH  /me/notifications/{id}
POST   /me/notifications/clear
GET    /me/documents
GET    /me/documents/{id}
POST   /resources/{id}/download-authorization
GET    /support
GET    /legal/{slug}
```

Add API-driven Explore, banners, and versioned app config. Preserve a compatibility response for older app versions until migration is complete.

### 25.3 Admin API groups

Admin endpoints SHOULD be under `/v1/admin` and include:

- `/auth`, `/sessions`, `/admins`, `/roles`, `/permissions`.
- `/dashboard`, `/learners`, `/batches`, `/enrollments`, `/entitlements`.
- `/courses`, `/semesters`, `/lessons`, `/resources`, `/media`.
- `/projects`, `/submissions`, `/semester-reviews`.
- `/questions`, `/tests`, `/test-windows`, `/attempts`, `/results`, `/rank-runs`.
- `/explore-sections`, `/banners`, `/app-config`.
- `/news`, `/awareness`, `/facts`, `/interview`.
- `/live-classes`, `/attendance`, `/recordings`, `/moderation`.
- `/notification-campaigns`, `/notification-templates`, `/delivery-logs`.
- `/products`, `/prices`, `/coupons`, `/orders`, `/refunds`, `/reconciliation`.
- `/document-templates`, `/documents`, `/verification-events`.
- `/support-cases`, `/legal`, `/privacy-requests`.
- `/reports`, `/exports`, `/audit-events`, `/jobs`, `/webhooks`, `/feature-flags`.

Command endpoints should describe intent, e.g. `POST /semester-reviews/{id}/approve`, not allow arbitrary status patching.

### 25.4 Webhooks

- Verify signature and timestamp, reject replays, store provider event ID uniquely, and retain redacted raw event for troubleshooting.
- Acknowledge quickly; process asynchronously and idempotently.
- Supported event domains: payment, refund/dispute, live-room state, recording, push delivery where available, email/SMS delivery, and storage/media processing.
- Provide admin webhook-event search, outcome, attempt history, and safe replay/reconcile action.

### 25.5 Realtime

- Authenticate and authorize every channel subscription.
- Use scoped channels for live room, host controls, chat, attendance, notification job progress, and dashboard updates.
- Reconnect with cursor/last-event recovery where supported.
- Realtime messages are hints/events; critical state is refetched from authoritative APIs.

---

## 26. Security, privacy, and compliance requirements

### 26.1 Application security

- Enforce authorization in the backend for every read and write; UI hiding is not security.
- Use secure cookies, CSRF protection where applicable, strict CORS, CSP, HSTS, secure headers, and modern TLS.
- Validate all input with allowlists and size limits.
- Sanitize rich text and protect against stored/reflected XSS.
- Use parameterized database access and safe object-storage keys.
- Scan uploads, restrict SVG/HTML, and serve untrusted files from an isolated origin.
- Prevent SSRF in external URLs/media import and allowlist redirect/deep-link schemes.
- Rate-limit authentication, lookup, export, send, verification, and provider-control endpoints.
- Encrypt sensitive data at rest and secrets in a managed secret store.
- Rotate secrets and signing keys; never commit credentials.
- Dependency and container scanning, SAST, secret scanning, and regular penetration testing are release requirements.

### 26.2 Privacy

- Collect and display only necessary learner data.
- Mask phone/email by default in lists and reveal only with permission/purpose logging.
- Define retention for learner activity, chat, attendance, IP/device, notification delivery, exports, uploads, recordings, and audit.
- Provide data export, correction, suspension, and deletion/anonymization workflows.
- Keep internal notes clearly labeled and access controlled.
- Do not expose one learner's data through exports, URLs, cache, notifications, live tokens, or rank payloads.

### 26.3 High-risk actions

Require re-authentication, reason, explicit impact preview, and elevated permission for:

- Bulk notification to all.
- Bulk access grant/revoke.
- Result recompute/override/publication after correction.
- Refund approval.
- Certificate revocation or bulk issuance.
- Role/permission/provider/security setting changes.
- Account deletion execution.
- Export containing sensitive PII or response-level assessment data.

### 26.4 Backup and recovery

- Automated encrypted database backups with documented retention.
- Object-versioning/lifecycle policy for critical documents and templates.
- Periodic restore tests with recorded recovery time and recovery point results.
- Queue/webhook recovery and idempotent replay procedures.
- Published content, issued documents, results, and audit records must be recoverable according to policy.

---

## 27. Non-functional requirements

### 27.1 Performance targets

- Common admin page initial server response: p95 under 1 second excluding large exports/provider latency.
- Filtered paginated table API: p95 under 800 ms for ordinary queries at target scale.
- Mutation acknowledgement: p95 under 1 second when not dependent on a provider; long work becomes a background job.
- Search suggestions: p95 under 500 ms.
- Dashboard may load modules independently so one failed metric does not blank the page.
- Define load targets before production for learner count, concurrent admins, active attempts, live participants, and bulk notification size.

### 27.2 Reliability

- Transactional API availability target: at least 99.9% monthly, excluding announced maintenance.
- Durable queues with retry/backoff, dead-letter handling, and alerting.
- Idempotent financial, academic approval, document, result, and notification operations.
- Provider outages degrade honestly: preserve drafts/schedules, show status, and offer retry/reconcile; never fabricate success.

### 27.3 Accessibility

- Target WCAG 2.2 AA.
- Full keyboard navigation, visible focus, semantic labels, proper tables/forms/dialogs, skip links, and screen-reader announcements.
- Color is never the only status indicator; meet contrast requirements.
- Accessible error summary linked to invalid fields.
- Live host controls must be keyboard operable and indicate mute/recording/status textually.

### 27.4 Browser and responsive support

- Latest two stable versions of Chrome, Edge, Firefox, and Safari for general admin use.
- Live hosting may publish a narrower supported-browser matrix based on provider SDK; run a preflight check and explain unsupported cases.
- Minimum practical desktop width around 1280 px; tablet layouts from 768 px; critical approvals/single notification actions remain usable below that.

### 27.5 Observability

- Structured logs with request/correlation IDs and redaction.
- Metrics for API latency/error, queue depth/age, job success, webhook failure, push failure, payment mismatch, live join failure, and document render failure.
- Distributed traces across API, worker, and providers where practical.
- Alerts include runbook link and affected environment; never include secrets or unnecessary PII.

---

## 28. UI page requirements and common states

Every page must implement:

- Loading skeleton appropriate to its layout.
- Empty state explaining why it is empty and the permitted next action.
- Permission-denied state distinct from not found.
- Recoverable error with request ID and retry.
- Offline/network-disconnected state for unsaved forms.
- Stale-data indication when realtime/polling is delayed.
- Success confirmation that names the affected resource.
- Concurrency conflict flow showing that another admin changed the record; do not silently overwrite.

### 28.1 Table standard

- Server pagination, sort, filter, search, selected count, clear filters, saved view, and column controls.
- Row selection persists only when safe and communicates whether it spans the current page or the full filtered result.
- Bulk-action eligibility is revalidated server-side at execution.
- Dates, currency, IDs, and status cells use consistent formatting.
- Row action menus are permission aware and keyboard accessible.

### 28.2 Form standard

- Grouped sections, field-level help, required indicators, validation on blur/submit, and error summary.
- Auto-save is allowed for drafts but must display save state and never auto-publish.
- Schedule fields show local time, timezone, and resulting UTC.
- Relationship pickers search by stable ID and title and show archived/unpublished state.
- Cancel/back with unsaved changes asks for confirmation.

### 28.3 Confirmation standard

For high impact, show:

- Action and exact target.
- Number of learners/records affected.
- Irreversible and downstream effects.
- Notification behavior.
- Reason field and approval requirement.
- Typed confirmation or re-authentication where configured.

---

## 29. Testing requirements

### 29.1 Automated tests

- Unit tests for permissions, state transitions, scoring, ranking, coupon math, eligibility, targeting, schedule/timezone, and document variables.
- Component tests for forms, validation, accessibility, tables, previews, and permission states.
- API integration tests with a real test database and transaction/constraint assertions.
- Contract tests between Admin, API, and React Native learner repositories/types.
- End-to-end tests for the critical journeys below.
- Provider adapter tests using signed sandbox webhooks and replay/duplicate scenarios.
- Load tests for active test saves/submits, live join authorization, notification fan-out, and large exports.
- Security tests for broken object authorization, role escalation, CSRF, XSS, file upload, SSRF, rate limiting, and secret leakage.

### 29.2 Required end-to-end journeys

1. Create Explore section -> approve/publish -> mobile config returns it -> rename/reorder without breaking target.
2. Create scheduled banner -> correct audience sees it -> target opens -> expired banner disappears.
3. Create course -> lessons/resources -> publish -> learner enrolls -> completes progress.
4. Build single-choice questions -> build/publish test -> learner attempts -> atomic submit -> result publish -> solution release.
5. Correct answer key -> dry-run recompute -> approve -> result revision and learner notification.
6. Submit project -> request changes -> resubmit -> accept -> submit semester review -> approve -> next semester unlock.
7. Schedule class -> reminders -> host preflight/start -> learner join/chat/hand -> end -> recording process/publish.
8. Send notification to exactly one user; then segment; then authorized all-user campaign with delivery report.
9. Payment verify -> entitlement grant; simulate `paidAccessPending` -> reconcile without second charge.
10. Generate certificate -> officer approval -> issue -> learner download -> public verification -> revoke/supersede.
11. Suspend learner -> sessions revoked -> protected access blocked -> reactivate without history loss.
12. Permission tests prove each role can and cannot perform its defined actions, including direct URL/API attempts.

### 29.3 Test data

- Use fictional seeded learners and obvious non-production documents.
- Cover active/new/suspended/deletion learners; free/paid/delayed entitlements; test expiry/ties; review rejection/resubmission; document revoked/superseded; live failure/recording; notification invalid tokens.
- Never copy production PII to development without an approved anonymization process.

---

## 30. Detailed release acceptance criteria

The first production release is acceptable only when:

### Administration and security

- [ ] Admin login, MFA, session expiry, logout, password recovery/SSO, and lockout work.
- [ ] Roles and granular permissions are enforced in UI and API.
- [ ] Critical actions require reasons/re-authentication/approval as specified.
- [ ] Audit log covers every specified high-impact action and cannot be edited.
- [ ] Secrets and forbidden learner/payment data are not visible or logged.

### Learners and learning

- [ ] Staff can search a learner and see the full authorized operational timeline.
- [ ] Enrollment and entitlement actions are independent, safe, and audited.
- [ ] Course, semester, lesson, resource, and project authoring work with preview/versioning.
- [ ] Project and semester review states match the mobile flow, including changes required and approval.
- [ ] Approval atomically unlocks only the allowed next stage.

### Explore and banners

- [ ] Explore labels/order/visibility/target are API-driven and editable without a mobile release.
- [ ] Stable IDs/deep links survive renames.
- [ ] Banner schedule, placement, audience, frequency, target validation, preview, and metrics work.
- [ ] One bad banner cannot break learner Home.

### Assessments and results

- [ ] Question bank and test builder validate all scoring and compatibility rules.
- [ ] Attempts use immutable snapshots, authoritative deadline, answer revision, and idempotent submission.
- [ ] Results are server-scored, reviewable, publishable, and correctable only through versioned audit.
- [ ] Solution visibility follows the configured release policy.
- [ ] Rank calculation and tie/exclusion rules are documented and deterministic.

### Live classes

- [ ] Admin can schedule, start, host, moderate, end, and reconcile a provider-backed live class.
- [ ] Learner join uses a short-lived authorized token.
- [ ] Attendance, chat/moderation, reminders, cancellation, and recording lifecycle work.
- [ ] Provider failure never creates a false live/recording state.

### Notifications

- [ ] Staff can safely send to one learner, selected learners, segment, and all eligible learners.
- [ ] Audience preview, test send, schedule, quiet hours/preferences, dedupe, queue, and logs work.
- [ ] Inbox and push state are distinguished.
- [ ] Notification targets are validated and access rechecked on open.

### Documents and commerce

- [ ] Templates are versioned and PDFs render without overflow on representative data.
- [ ] Eligibility, generation, approval, issuance, QR verification, revoke, and supersede work.
- [ ] Orders, provider verification, coupons, entitlement, delayed access, refunds, and reconciliation are auditable.
- [ ] No client/admin shortcut fabricates successful payment or grants unintended access.

### Quality and operations

- [ ] Required automated/E2E/accessibility/security tests pass.
- [ ] Production monitoring, alerting, backups, restore test, and operational runbooks exist.
- [ ] OpenAPI and provider setup/webhook documentation are current.
- [ ] A staging sign-off verifies Admin -> API -> mobile behavior with production-like configuration.

---

## 31. Delivery plan

### Phase 0 — Foundations

- Confirm backend ownership, provider choices, environments, organization timezone, data retention, and legal policies.
- Set up admin auth/MFA, RBAC, audit, database migrations, object storage, worker/queue, OpenAPI, CI/CD, observability, and seed data.
- Implement shared IDs, content lifecycle, file library, jobs, approval primitives, and API error/pagination standards.

### Phase 1 — Core operations and content

- Dashboard, learners, batches, enrollments/entitlements.
- Courses, curriculum, lessons/resources, editorial content.
- API-driven Explore and banners/app config.
- Basic reports and audit search.

### Phase 2 — Assessments and academic approvals

- Question bank, tests, schedules, attempts, scoring, results, analytics.
- Projects, submissions, semester review, approve/reject/resubmit/unlock.
- Compatibility contract tests with the learner app.

### Phase 3 — Communications and live classes

- Templates, single/segment/all notification campaigns and delivery logs.
- Live provider adapter, scheduling, host room, attendance, chat/moderation, recordings.

### Phase 4 — Documents and commerce operations

- Products/prices/coupons/orders/reconciliation/refunds.
- Certificate/admit-card template, eligibility, generation, issue, verification, revoke/reissue.

### Phase 5 — Hardening and launch

- Performance/load/security/accessibility testing.
- Data migration, staging dress rehearsal, provider webhook tests, backup restore, runbooks, training, least-privilege role sign-off, and phased production rollout.

Phases may be developed in parallel only after the foundation contracts are stable. Do not ship a content-only UI that bypasses authorization, audit, versioning, or job safety.

---

## 32. Cursor implementation instructions

When Cursor or another coding agent implements this specification, it must follow these rules:

1. Read this document plus the existing `README.md`, `docs/architecture.md`, `docs/api-integration.md`, `docs/backend-handoff.md`, `docs/flows/`, `src/core/types.ts`, `src/core/repositories.ts`, and `src/core/api/httpRepositories.ts` before changing contracts.
2. Treat the current repository as the learner client. Create the admin/backend in intentionally named separate packages/projects; do not mix admin screens into React Native navigation.
3. First produce an architecture decision record, database schema, OpenAPI draft, permission matrix, and implementation plan mapped to these requirement IDs/sections.
4. Use strict TypeScript. Avoid `any`; validate all external/provider/API input at runtime.
5. Implement database migrations and seeds; never depend on auto-sync in shared/production environments.
6. Put business rules in services/domain modules, not React components or route handlers.
7. Enforce permissions in backend services/controllers and cover them with negative tests.
8. Model explicit state transitions. Do not expose generic admin `status` patching for approvals, payments, results, documents, or live state.
9. Use transactions, idempotency, outbox/jobs, and concurrency control for high-impact workflows.
10. Keep providers behind interfaces with sandbox/fake adapters for automated tests.
11. Store private files in private buckets; issue short-lived scoped URLs only after authorization.
12. Generate an OpenAPI client or shared DTO package where appropriate, but keep mobile/domain mapping at repository boundaries.
13. Add loading, empty, error, permission-denied, stale, and conflict states to every page during initial implementation, not as cleanup.
14. Add audit events in the same pull request as every sensitive mutation.
15. Add tests in the same unit of work as each feature and keep the listed end-to-end journeys executable.
16. Never invent production provider success. If a provider is not configured, show capability-unavailable state and retain safe drafts.
17. Preserve all unrelated learner-app behavior and existing user changes in the workspace.
18. Before calling a feature complete, run typecheck, lint, unit/integration tests, E2E for the affected journey, migration test, and accessibility checks.

### 32.1 Suggested repository layout

If the products are kept in one monorepo, use an explicit layout similar to:

```text
apps/
  learner-mobile/       # existing React Native application
  admin-web/            # admin portal
  api/                  # REST/realtime API
  worker/               # background jobs
packages/
  contracts/            # OpenAPI/generated DTOs or shared schemas
  domain/               # framework-independent domain types/rules where practical
  admin-ui/             # admin design system
  config/               # lint/ts/test shared config
docs/
  architecture-decisions/
  api/
  runbooks/
```

Do not move the existing app into a monorepo as an incidental first step unless that migration is explicitly approved and tested.

### 32.2 Implementation slice definition of done

Each feature slice must include:

- Migration/schema and seed changes.
- Permission definitions and default-role mapping.
- Backend validation, service, endpoint, OpenAPI, and audit.
- Admin page/form/table/states and accessibility.
- Worker/job/provider behavior if needed.
- Learner API/contract changes if needed, with backward compatibility.
- Unit, integration, permission-negative, and E2E tests.
- Metrics/logging/alerts appropriate to risk.
- Short operational documentation and rollback/migration notes.

---

## 33. Decisions required before production integration

These choices do not block scaffolding, but must be explicitly decided before the related production feature is enabled:

1. Backend framework/hosting, database, cache/queue, and object-storage providers.
2. Admin SSO/password/MFA provider and staff identity lifecycle.
3. Live video provider, maximum participants, browser support, recording/consent, and retention.
4. Payment route: India gateway, Play Billing/App Store requirements, web checkout, refund and tax policy.
5. Push provider projects/credentials, quiet hours, promotional consent, email/SMS vendors.
6. Official organization identity, certificate/admit-card legal fields, signatories, serial pattern, QR verification domain, revocation policy, and signature custody.
7. Test scoring/rank/tie/normalization, retry, late start, result/solution release, and correction approval policies.
8. Semester review SLA, required evidence, approval/rejection/resubmission, and unlock rules per course.
9. Supported locales and who owns translation/review.
10. Retention and privacy policy by record type, account deletion/anonymization, and legal holds.
11. Organization timezone, branch model, academic year, batch naming, and role scope.
12. Production scale targets and required service-level objectives.

Until a decision is made, the system must use an explicit “not configured/unavailable” state rather than a fabricated provider, legal promise, certificate verification, live room, push delivery, or payment result.

---

## 34. Final product principles

- **The server is authoritative.** The admin UI requests commands; it does not bypass domain rules.
- **Editable names, stable identity.** Admins may rename and reorder learner-facing content without breaking IDs or history.
- **Visibility is not deletion.** Unpublish/archive safely while preserving enrollments, attempts, results, documents, and audits.
- **Every consequential action is attributable.** Reasons, approvals, versions, and before/after history matter.
- **Bulk action deserves bulk safety.** Preview audience/impact, confirm, queue, deduplicate, report failures, and support recovery.
- **Provider truth is reconciled, not invented.** Payments, live rooms, recordings, and delivery receipts remain honest.
- **Academic records are immutable-by-revision.** Corrections create traceable new revisions instead of rewriting history.
- **Least privilege by default.** Staff see and control only what their role and scope require.
- **The learner experience stays coherent.** Admin configuration must pass target, access, version, and publication validation before learners can receive it.
