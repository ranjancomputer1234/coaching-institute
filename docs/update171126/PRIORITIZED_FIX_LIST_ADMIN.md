# REDI admin panel — prioritized fix list

Date: 17 November 2026  
Audience: admin-web team (and API work required so admin actions reach the learner app)  
Companion: `PRIORITIZED_FIX_LIST_APP.md`  
Source: `FULL_SYSTEM_AND_ENDPOINT_REPORT.md`  
Out of scope: live chat

Priority legend:

| Priority | Meaning |
|---|---|
| P0 | Staff cannot get core content or paid access into the app |
| P1 | Admin workflows exist but learner journeys still fail without admin/API changes |
| P2 | Admin UI incomplete or permission-mismatched |
| P3 | Optional admin/reporting polish |

Where an item needs an **API** change for the admin UI to work, that dependency is listed. Pure learner-client work lives in the app list.

---

## P0 — Must fix first

### 1. Lesson publish (so courses show in the app)

**Problem:** Lessons created in admin stay `draft`. Course publish does not publish lessons. No publish-lesson control.

**Admin work:**

- [ ] Add Publish on each lesson (Lessons / Courses UI).
- [ ] Product decision: publish lessons individually **or** auto-publish draft lessons when the course is published.

**Depends on API:**

- [ ] `POST /api/admin/courses/:courseId/lessons/:lessonId/publish` (and/or publish-all on course publish).

**Verify:** Create course → add lesson → publish → `GET /api/courses/:id/lessons` (no staff token) is non-empty.

---

### 2. Entitlements screen + paid unlock from orders

**Problem:** Entitlement APIs exist; no admin screen. Order reconcile to `paid_manual` does not grant access.

**Admin work:**

- [ ] New Entitlements screen: list, grant, revoke (`/api/admin/entitlements*`).
- [ ] On Orders: after reconcile, show whether entitlement was granted (or require explicit grant until API links them).

**Depends on API:**

- [ ] Grant course/resource entitlement when order is reconciled to paid (same transaction preferred).

**Verify:** Staff grant (or paid reconcile) → learner course `access.granted: true`.

---

### 3. Production API deploy (shared with DevOps)

**Problem:** Production previously 404’d catalogue routes the source implements.

**Admin / ops work:**

- [ ] Confirm admin `VITE_API_BASE_URL` points at the redeployed host.
- [ ] Smoke-test admin publish → learner `GET` on that host.

**Depends on API / DevOps:** Redeploy from current API tree; health + catalogue paths return 200.

---

## P1 — Admin side of learner journeys

### 4. Assessments: authoring stays admin; stop using staff attempts as the learner path

**Admin work:**

- [ ] Keep Questions / Tests / Exams / Results publish flows as the content pipeline.
- [ ] Document for staff: learner sitting happens in the app once learner attempt APIs exist — admin Attempts is not the student UX.
- [ ] Fix Attempts UI so submit is not “all skipped” (wire answer posting, or hide create/submit-as-learner until answers exist).

**Depends on API (mostly app list):** learner attempt/result routes. Admin still needs `results.publish` so the app can show scores.

**Verify:** Publish exam + test with approved questions → visible on learner `GET /exams` and `GET /tests`.

---

### 5. Semesters / projects review (already present — keep reliable)

**Admin work:**

- [ ] Keep Semesters + Projects review/approve/request-changes.
- [ ] Ensure staff with only `semester.review` do not see Approve if API needs `semester.approve` (see P2 permissions), or grant the right role.

**Depends on API/App:** learner semester/project routes (app list). Admin can already operate the review queue.

**Verify:** Approve pending review → next semester unlocks for that enrolment when learner APIs exist.

---

### 6. Commerce ops

**Admin work:**

- [ ] Keep Products, Coupons, Orders, Refunds.
- [ ] Align Order reconcile button visibility with `payments.refund_approve` (see P2).
- [ ] After P0 #2, treat paid reconcile as the unlock path (or always open Entitlements).

**Depends on API/App:** learner checkout routes (app list).

---

### 7. Notifications send → inbox rows

**Admin work:**

- [ ] Keep campaign create/send UI.
- [ ] Align Send button with `notifications.send_bulk` (see P2).
- [ ] Confirm send creates durable inbox records for learners (not push-only).

**Depends on API:** learner inbox + push provider config.

**Verify:** Send campaign → learner inbox item exists (once app wires inbox).

---

### 8. Documents and legal (admin already strong)

**Admin work:**

- [ ] Keep issue/revoke certificates and admit cards.
- [ ] Add Document templates screen (`GET/POST /admin/document-templates`) — API exists, UI missing.
- [ ] Keep Legal editor; publish before expecting app Legal screens to work.

---

### 9. Live schedule / provider (no chat)

**Admin work:**

- [ ] Staff process: always press **Schedule** (draft never appears in the app).
- [ ] Configure Daily.co (or provider) so join/playback URLs are set.
- [ ] Audience / batch selection matches who should join.

**Verify:** Scheduled class appears on learner `GET /live-classes`; join works in live/starting/reconnecting or with ready recording.

---

## P2 — Admin UI and permissions

### 10. Wire admin UI for APIs that already exist

- [ ] Learner create / patch (`POST/PATCH /admin/learners`)
- [ ] Course unpublish
- [ ] Explore section reorder (`POST .../explore-sections/reorder`)
- [ ] Exam / test / question PATCH; question retire
- [ ] Document templates list/create
- [ ] Attempts: post `/attempts/:id/answers/:questionId` before submit (or remove misleading submit)

### 11. Align nav / button permissions with API

| Action | UI gate today | API requires |
|---|---|---|
| Reconcile order | `payments.read` | `payments.refund_approve` |
| Send notification | `notifications.send_single` | `notifications.send_bulk` |
| Create refund | page needs `payments.refund_approve` | `payments.refund_request` |
| Publish content | often `content.edit` | `content.publish` |
| Publish test / approve question | `assessments.author` | `assessments.publish` |
| Accept project / approve semester | `semester.review` | `semester.approve` |
| Support list / write | no nav key | `users.read` / `users.update` |

- [ ] Hide or disable actions the role cannot complete, or adjust API keys to match product intent.

### 12. Editorial paid unlock workflow

- [ ] Clear pricing UI for news/awareness (and product decision with API on how grant works).
- [ ] Staff path to unlock paid editorial once API supports entitlement/scope.

### 13. Search indexing (admin content quality)

No dedicated admin search screen required. Ensure published titles/summaries are filled so API search (when extended) returns useful hits.

---

## P3 — Optional

### 14. Auth / account (admin support tooling)

- [ ] Optional: admin visibility into verification / deletion request status when those APIs exist.
- [ ] Server logout endpoint exists but UI only clears local token — optional call to `POST /admin/auth/logout`.

### 15. Bookmark / interview gating reports

- [ ] Only if product wants staff reporting on saves or locked interview answers — no CMS required for basic learner bookmarks.

---

## Admin delivery order

| Slice | Items | Outcome |
|---|---|---|
| A | P0 #1, #2, #3 | Lessons visible; paid unlock operable; admin points at current API |
| B | P1 #4, #8 templates | Clean assessment publish path; document templates |
| C | P1 #5–#7, #9 | Review, commerce ops, notifications, live schedule reliable |
| D | P2 #10–#12 | Complete UI + permission safety |
| E | P3 | Optional tooling |

---

## Admin verification checklist

1. Publish from admin → matching learner `GET` returns the row.
2. Lesson publish → course lessons non-empty in the app API.
3. Entitlement grant or paid reconcile → paid course unlocks.
4. Narrow roles never see a primary button that always returns `403 FORBIDDEN`.
5. Live class: Schedule pressed; not left in draft.

---

## Explicitly deferred

- Live chat moderation / faculty chat tooling.
