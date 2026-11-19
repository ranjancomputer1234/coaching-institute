# REDI — Admin panel ↔ Learner app alignment checklist

**Date:** 17 November 2026  
**Purpose:** Compare what staff do in the **admin panel** with what the **learner app** must call on the API, and mark whether each path is **aligned**, **partial**, or **missing**.  
**Production API:** `https://redi-api-production.up.railway.app/api`  
**Out of scope:** live chat

Use this file as a QA / handover checklist. For each row: do the **Admin action**, then hit the **App / learner check**. If both pass → mark ✅. If admin works but app fails → mark ❌ and note the gap.

### Status legend

| Status | Meaning |
|---|---|
| **Aligned** | Admin can publish/operate; learner API exists and matches expected contract |
| **Partial** | Main path works; gaps, caveats, or missing polish remain |
| **Missing** | App or learner API cannot complete the journey yet |
| **Staff-only** | Correct that learners never see this |

### How to verify (quick)

1. Admin: log in → perform the staff action → note ids (course, lesson, campaign, etc.).
2. Learner API: use admin-created content via the listed `GET`/`POST` routes (Bearer learner JWT where required).
3. App: open the matching screen and confirm UI shows the same published row / unlock / score / inbox item.

---

## 0. Production smoke (do this first)

| # | Check | How | Expected | Pass? |
|---|---|---|---|---|
| 0.1 | API health | `GET /api/health` | `{ "status": "ok", "database": "ok" }` | ☐ |
| 0.2 | Catalogue live | `GET /api/home`, `/courses`, `/exams`, `/tests` | HTTP 200, non-empty or empty arrays (not 404/500) | ☐ |
| 0.3 | Editorial live | `GET /api/news`, `/awareness/topics`, `/facts/categories`, `/interview/questions` | HTTP 200 | ☐ |
| 0.4 | Admin points at prod | Admin env `VITE_API_BASE_URL` = production API host | Staff login + list screens load | ☐ |
| 0.5 | Learner auth | `POST /api/auth/login` with a real learner | `accessToken` returned | ☐ |

---

## 1. Auth & accounts

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Staff login | `/login` → `POST /admin/auth/login`, `GET /admin/auth/me` | — | **Aligned** | ☐ Staff can open dashboard |
| Learner register/login | — | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /me` | **Aligned** | ☐ App login works |
| Staff logout | Client clears token (optional `POST /admin/auth/logout`) | `POST /auth/logout` | **Partial** | ☐ Optional server logout |
| Create learner for app login | Learners list/suspend only; `POST /admin/learners` creates **profile without password** | App must `register` or credential must exist | **Partial** | ☐ New app user can login |
| Suspend learner | Learners → Suspend | Blocked on next learner JWT use | **Aligned** | ☐ Suspended user cannot use app |

**Loopholes:** No OTP / Google / refresh tokens. Admin “create learner” ≠ ready-to-login app account unless register or password seed exists.

---

## 2. Home, Explore, Banners

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Explore tiles | `/explore` create / rename / ↑↓ reorder / publish | `GET /home` → `sections`; `GET /categories` | **Aligned** | ☐ Published + `homeVisible` tile appears on Home |
| Stable Explore ids | Seed/keep: `computer-courses`, `competitive-exam`, `news`, `general-awareness`, `amazing-facts`, `interview-prep` | App deep links / banners use same ids | **Aligned** (if seeded) | ☐ Ids never change after publish |
| Home banners | `/banners` create / publish / pause | `GET /home` → `banners` (hero, dated, with image) | **Aligned** | ☐ Published hero banner with image shows |
| Featured courses | Courses → featured + publish | `GET /home` → `featuredCourses` | **Partial** | ☐ Featured published course on Home |
| Search | No dedicated admin search CMS | `GET /search?q=` | **Partial** | ☐ Published titles searchable |

**Staff rule:** Publishing Explore does **not** create courses/exams/news — only navigation tiles.

---

## 3. Courses, lessons, resources

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Create course | `/courses` → Create draft (Free/Paid + ₹) | — | **Aligned** | ☐ Draft appears in admin list as FREE or ₹… |
| Publish course | Publish (bulk-publishes draft lessons) | `GET /courses`, `GET /courses/:id` | **Aligned** | ☐ Published course in app catalogue |
| Per-lesson publish | Courses → Lessons → Publish | `GET /courses/:id/lessons` (published only) | **Aligned** | ☐ Draft lesson **absent** until publish |
| Add lesson on live course | Add lesson → auto-published if course already published | Lessons list non-empty | **Aligned** | ☐ New lesson visible without re-publish |
| Unpublish course | Unpublish | Course 404 / unavailable on learner API | **Aligned** | ☐ App no longer opens course |
| Price display | Paid requires ₹ ≥ 1; list shows ₹amount | Learner `price: { amountMinor, currency }` or null | **Aligned** | ☐ App shows ₹499 not bare “PAID” |
| Course arrange | ↑↓ reorder → `POST /admin/courses/reorder` | `GET /courses` ordered by `sortOrder` | **Aligned** | ☐ Order matches admin |
| Attach video/PDF | `/lessons` upload Mux/Cloudinary | Lesson detail + download grant routes | **Partial** | ☐ Preview/playback when media ready |
| Enroll free course | — | `POST /courses/:id/enroll`, progress/complete | **Aligned** | ☐ Free course enroll + progress |
| Semester outline in app | Semesters admin exists | **No** learner semester outline API | **Missing** | ☐ Certification courses still flat lesson list |

**Loopholes:** Learner API only returns **published** lessons. Course publish with **zero** lessons is rejected. Paid course without entitlement: `access.granted: false`.

### Paid course unlock path

| Step | Admin | Learner check | Status | Pass? |
|---|---|---|---|---|
| A | Products → create with **Course ID** + price | — | **Aligned** | ☐ |
| B | Orders → create pending → Reconcile (needs `payments.refund_approve`) | `GET /courses/:id/access` → `granted: true` | **Aligned** | ☐ |
| C | Or Entitlements → Grant access | Same access check | **Aligned** | ☐ |
| D | App self-checkout | **No** learner `POST /orders` / payment | **Missing** | ☐ N/A until checkout |

---

## 4. Competitive exams, tests, attempts

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Create/publish exam | `/exams` | `GET /exams`, `GET /exams/:id` | **Aligned** | ☐ Exam card in app |
| Create/publish test | `/tests` attach questions | `GET /tests?examId=`, `GET /tests/:id` (metadata only — **no** questions) | **Aligned** | ☐ Instructions screen: N questions, duration |
| Question bank | `/questions` create + approve | Loaded only inside attempt snapshot | **Aligned** | ☐ Approved Q appears after Begin test |
| Begin test | — | `POST /tests/:id/attempts` | **Aligned** | ☐ Attempt `in_progress`; **no** `correctOptionId` in JSON |
| Save answers | Admin Attempts has no answer UI | `PUT|POST /attempts/:id/answers/:questionId` | **Aligned** (app) / **Partial** (admin) | ☐ Answer persists on resume |
| Submit + score | Admin can force-submit (often all skipped) | `POST /attempts/:id/submit` | **Aligned** | ☐ Score computed |
| See result | `/results` publish | `GET /attempts/:id/result` | **Partial** | ☐ Visible when published **or** policy ≠ `after_manual_publish` |
| My attempts | — | `GET /me/attempts` | **Aligned** | ☐ History list |

**Staff rule:** Learner sitting happens in the **app**. Admin Attempts is ops/debug, not the student UX. If `resultPolicy` is `after_manual_publish`, publish from Results before the app shows scores.

**Loopholes:** Paid tests need entitlement (scope test/course). `attemptLimit` enforced. Admin submit without answers → all skipped scores.

---

## 5. Semesters & projects

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Review queue | `/semesters`, `/projects` approve / request-changes | — | **Staff-only** | ☐ Staff can approve |
| Learner outline / unlock next semester | — | **No** learner semester/project routes | **Missing** | ☐ App cannot drive certification unlock |
| Learner project submit | — | **Missing** | **Missing** | ☐ |

---

## 6. Editorial content

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| News | `/news` create + publish | `GET /news`, `GET /news/:id` | **Aligned** | ☐ Article visible when published |
| General awareness | `/awareness` | `GET /awareness/topics`, `GET /awareness/topics/:id` | **Aligned** | ☐ Entries only if access granted |
| Amazing facts | `/facts` | `GET /facts`, `GET /facts/:id`, `PUT /facts/:id/reaction` | **Aligned** | ☐ Reaction works logged-in |
| Interview prep | `/interview` | `GET /interview/categories`, `.../questions`, `.../questions/:id` | **Partial** | ☐ List works; **model answers may be unlocked for all** (product mismatch) |
| Paid editorial unlock | Entitlements with editorial/category scope | `resolvePricingAccess` + entitlement check | **Partial** | ☐ Grant → body/entries appear |

---

## 7. Live classes

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Create draft | `/live-classes` | Not visible | **Aligned** | ☐ Draft absent from app |
| Schedule | Press **Schedule** (Daily when configured) | `GET /live-classes` | **Aligned** | ☐ Scheduled class listed |
| Join | Provider join URL | `POST /live-classes/:id/join` | **Partial** | ☐ Join works if live + provider configured |
| Reminder / hand | — | `PUT .../reminder`, `PUT .../hand` | **Aligned** | ☐ |

**Staff rule:** Draft never appears in the app. Always press Schedule. Audience/batch must match who should join.

---

## 8. Notifications

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Templates | `/notification-templates` | — | **Aligned** | ☐ |
| Create campaign | `/notifications` title, body, category, audience, target | — | **Aligned** | ☐ |
| Send → inbox | Send (`notifications.send_bulk`) creates **one inbox row per eligible learner** | `GET /me/notifications` | **Aligned** | ☐ After send, learner sees title/body |
| Mark read / clear | — | `PATCH /me/notifications/:id`, `POST /me/notifications/clear` | **Aligned** | ☐ |
| Android push / devices | Push adapter often not configured | **No** `/me/push-devices/*` | **Missing** | ☐ Inbox still works without FCM |

**Staff rule:** Inbox is authoritative. Push can fail; learners must still see the message in Notifications.

---

## 9. Documents, certificates, admit cards, legal

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Templates | `/document-templates` | — | **Aligned** | ☐ |
| Issue certificate / admit | `/certificates`, `/admit-cards` | `GET /me/documents`, `GET /me/documents/:id` (includes `details`, `learnerName`) | **Partial** | ☐ Issued doc listed; details usable |
| Verify | Public token | `GET /documents/verify/:token` | **Aligned** | ☐ Valid issued → `valid: true` |
| Download PDF | Issue stores resource key | `POST /resources/:id/download-authorization` | **Partial** | ☐ Works only if storage configured |
| Reissue / generate pipeline | One-shot issue | Full generate→approve→reissue | **Missing** | ☐ |
| Legal pages | `/legal` publish | `GET /legal`, `GET /legal/:slug`; public `/policies` | **Aligned** | ☐ App Legal matches published HTML |

---

## 10. Commerce, support, ops (staff-heavy)

| Theme | Admin | Learner API / app | Status | Verify |
|---|---|---|---|---|
| Products / coupons / refunds | `/products`, `/coupons`, `/refunds` | No learner checkout | **Partial** / **Missing** checkout | ☐ Refunds buttons respect permissions |
| Support tickets | `/support` | No learner ticket API | **Missing** | ☐ |
| Reports / audit / staff | `/reports`, `/audit`, `/staff` | — | **Staff-only** | ☐ |
| Settings | `/settings` | — | **Staff-only** | ☐ |

---

## 11. End-to-end journeys (must pass)

Use these as release gates. All assume production API + published content.

### Journey A — Free course

1. Admin: Create free course → Add lesson → Publish course (or publish lesson).  
2. App: Catalogue shows course → open → lessons non-empty → enroll → progress.  
3. **Pass when:** `GET /courses/:id/lessons` without staff token returns the lesson.

### Journey B — Paid course unlock

1. Admin: Paid course with ₹ price → Publish → Product with that `courseId` → Order → Reconcile **or** Entitlements → Grant.  
2. App: Before unlock `access.granted: false`; after unlock `true` → enroll/open.  
3. **Pass when:** Reconcile response `accessGranted: true` and learner access grants.

### Journey C — Competitive test

1. Admin: Exam + approved questions + test with questions → Publish exam & test.  
2. App: Begin test → answer → submit → result (publish result if policy requires).  
3. **Pass when:** Attempt JSON has no `correctOptionId`; submit returns score; result readable when allowed.

### Journey D — Notification

1. Admin: Campaign audience **All** (or single learner) → Send.  
2. App: Notifications inbox shows row → mark read.  
3. **Pass when:** `GET /me/notifications` contains campaign title after send.

### Journey E — Live class

1. Admin: Create → **Schedule** → set audience.  
2. App: Live list shows class → Join when live/provider ready.  
3. **Pass when:** Draft never listed; scheduled listed.

---

## 12. Alignment scoreboard (summary)

| Domain | Status | Notes |
|---|---|---|
| Auth (basic) | **Aligned** | No social/OTP |
| Home / Explore / Banners | **Aligned** | Publish + homeVisible required |
| Courses / lessons / pricing | **Aligned** | Semester outline missing for app |
| Paid unlock (staff) | **Aligned** | App checkout missing |
| Exams / attempts | **Aligned** | Manual result publish; admin answer UI weak |
| Semesters / projects (app) | **Missing** | Admin queue only |
| Editorial | **Partial** | Interview answers may be too open |
| Live classes | **Aligned** | Needs Schedule + provider |
| Notifications inbox | **Aligned** | Push devices missing |
| Documents | **Partial** | Metadata OK; PDF pipeline thin |
| Learner support / checkout | **Missing** | Staff-only today |

---

## 13. Known mismatches / loopholes (watch list)

1. **Draft lessons** never appear in the app (by design). Staff must Publish lesson or Publish course.  
2. **Paid course** without Product `courseId` → reconcile does **not** unlock; use Entitlements.  
3. **Result policy** `after_manual_publish` → app result 403 until Results → Publish.  
4. **Interview model answers** may return unlocked — confirm product intent.  
5. **Certification / semester** unlock is admin-side only until learner semester APIs exist.  
6. **Checkout** is not in the learner API — purchases are staff reconcile/grant.  
7. **FCM** may be `not_configured` — inbox still required and must work.  
8. **Explore tile ≠ content** — publishing Explore never creates courses/news/exams.  
9. Railway **preDeploy migrate** has previously been skipped against the live DB — after schema changes, confirm migration applied (or run `prisma migrate deploy` against prod) before smoke.

---

## 14. Related docs

| Doc | Use |
|---|---|
| `docs/update171126/PRIORITIZED_FIX_LIST_ADMIN.md` | Admin backlog |
| `docs/update171126/PRIORITIZED_FIX_LIST.md` | Ownership map |
| `docs/update171126/09`–`18-*.md` | Per-module handovers |
| `docs/FULL_SYSTEM_AND_ENDPOINT_REPORT.md` | Broader endpoint inventory (may lag code) |
| `docs/APP_DEVELOPER_HANDOVER.md` | App developer contract |
| `docs/DEPLOY_RAILWAY.md` | Deploy / migrate |

---

## 15. Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Admin QA | | | Journeys A–E |
| App QA | | | Same journeys on device |
| Backend | | | Prod health + migrate confirmed |

**Release rule:** Do not call the release “aligned” until Journeys **A–D** pass on production. Journey **E** required if Live is in scope for the release.
