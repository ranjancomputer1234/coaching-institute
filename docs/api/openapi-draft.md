# REDI Admin API — OpenAPI Draft (Phase 0–1)

Base URL: `/api`  
Auth: `Authorization: Bearer <jwt>`  
Error envelope:

```json
{
  "code": "FORBIDDEN",
  "message": "Missing permission: explore.manage",
  "fieldErrors": {},
  "requestId": "req_..."
}
```

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/admin/auth/login` | Admin email/password → token + user + permissions |
| GET | `/admin/auth/me` | Current admin + permissions |
| POST | `/admin/auth/logout` | Client discard (cookie session later) |
| POST | `/auth/register` | Learner self-register |
| POST | `/auth/login` | Learner JWT (`typ: learner`) |
| POST | `/auth/logout` | Learner logout |
| GET/PATCH | `/me` | Learner profile |

> Breaking: admin no longer aliases `/auth/*`. Use `/admin/auth/*` for the admin SPA.

## Dashboard

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/dashboard` | any authenticated admin |

## Learners

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/learners` | `users.read` |
| GET | `/admin/learners/:id` | `users.read` |
| POST | `/admin/learners` | `users.update` |
| PATCH | `/admin/learners/:id` | `users.update` |
| POST | `/admin/learners/:id/suspend` | `users.suspend` |
| POST | `/admin/learners/:id/reactivate` | `users.suspend` |

## Batches

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/admin/batches` | `users.read` / `enrollments.create` |
| GET/PATCH/DELETE | `/admin/batches/:id` | scoped |

## Courses

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/admin/courses` | `content.edit` / `content.create` |
| GET/PATCH | `/admin/courses/:id` | `content.edit` |
| POST | `/admin/courses/:id/publish` | `content.publish` |
| POST | `/admin/courses/:id/unpublish` | `content.publish` |
| POST | `/admin/courses/:id/lessons` | `content.edit` |

## Explore sections

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/admin/explore-sections` | `explore.manage` |
| PATCH | `/admin/explore-sections/:id` | `explore.manage` |
| POST | `/admin/explore-sections/:id/publish` | `explore.manage` |
| POST | `/admin/explore-sections/reorder` | `explore.manage` |

## Banners

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/admin/banners` | `banners.manage` |
| PATCH | `/admin/banners/:id` | `banners.manage` |
| POST | `/admin/banners/:id/publish` | `banners.manage` |
| POST | `/admin/banners/:id/pause` | `banners.manage` |

## Audit

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/audit-events` | `audit.read` |

## Learner-facing (Phase L — protected content)

See `docs/backend-handoff.md` for full contracts.

| Method | Path | Auth |
|---|---|---|
| GET | `/home`, `/home/me`, `/categories`, `/search` | public / learner |
| GET | `/courses/:id`, `/courses/:id/lessons`, `/lessons/:id` | public (published) |
| GET | `/courses/:id/access` | learner |
| POST | `/courses/:id/enroll` | learner |
| POST | `/lessons/:id/progress`, `/lessons/:id/complete` | learner |
| GET | `/me/enrollments`, `/me/entitlements` | learner |
| GET | `/me/documents`, `/me/documents/:id` | learner |
| POST | `/resources/:id/download-authorization` | learner |
| GET | `/protected/delivery/:resourceId` | delivery token |
| GET | `/crypto/offline-verification` | public |
| GET | `/documents/verify/:token` | public |

## Admin — resources / documents / entitlements

| Method | Path | Permission |
|---|---|---|
| GET/POST | `/admin/resources` | `content.edit` / `content.create` |
| GET/POST | `/admin/document-templates` | `documents.generate` |
| GET | `/admin/documents` | `documents.issue` |
| POST | `/admin/documents/issue` | `documents.issue` |
| POST | `/admin/documents/:id/revoke` | `documents.revoke` |
| GET | `/admin/entitlements` | `enrollments.create` |
| POST | `/admin/entitlements/grant` | `enrollments.create` |
| POST | `/admin/entitlements/:id/revoke` | `enrollments.revoke` |
