# REDI Backend Handoff — Learner Protected Content API

For the React Native learner app team implementing `docs/REDI_Dummy_Data_API_and_Protected_Downloads_Prompt.md`.

**Scope:** implemented in `apps/api` only. Admin SPA and mobile app are out of this change set.

## Auth split (breaking change)

| Audience | Login | Profile |
|---|---|---|
| Admin | `POST /api/admin/auth/login` | `GET /api/admin/auth/me` |
| Learner | `POST /api/auth/login` | `GET /api/me` |

Legacy admin aliases on `/api/auth/*` were removed so learner contracts can own `/auth` and `/me` per requirements §25.2.

Seed learner: `riya@learner.local` / `learner123`  
Seed admin: `admin@institute.local` / `admin123`

Learner JWT payload includes `typ: "learner"`. Do not send admin tokens to learner routes.

## Learner endpoints implemented

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Creates learner + credential |
| POST | `/auth/login` | Learner JWT |
| POST | `/auth/logout` | Client discard |
| GET/PATCH | `/me` | Profile |
| GET | `/home` | Public home (banners, explore, featured) |
| GET | `/home/me` | Home + continuing lessons |
| GET | `/categories` | Published explore sections |
| GET | `/search?q=` | Courses/lessons |
| GET | `/courses/:id` | Published course detail |
| GET | `/courses/:id/access` | Course + entitlement projection |
| POST | `/courses/:id/enroll` | Free/entitled enroll |
| GET | `/courses/:id/lessons` | Published lessons |
| GET | `/lessons/:id` | Lesson (no public media export URL) |
| POST | `/lessons/:id/progress` | Progress upsert |
| POST | `/lessons/:id/complete` | Mark complete |
| GET | `/me/enrollments` | |
| GET | `/me/entitlements` | |
| GET | `/me/documents` | Admit cards / certificates metadata |
| GET | `/me/documents/:id` | Points to download-authorization |
| POST | `/resources/:id/download-authorization` | **Protected download contract** |
| GET | `/protected/delivery/:resourceId?token=` | Short-lived delivery metadata |
| GET | `/crypto/offline-verification` | Public kid/algorithm only |
| GET | `/documents/verify/:token` | Public verification (minimal fields) |

## Admin endpoints added

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

## Download authorization response (mobile contract)

`POST /api/resources/:id/download-authorization`

Body (optional): `{ "deviceId": "...", "installationId": "..." }`

Returns:

- `entitlement` — granted/download/preview/expiry/source
- `delivery` — short-lived URL + integrity + encryption hints; `exportForbidden: true`
- `offlineAuthorization` — signed HMAC grant (`kid`, `signature`, scoped payload)
- `drm` — for videos: Widevine/FairPlay fields **or** `status: provider_configuration_required`
- `document` — issue/revoke metadata when resource is an admit card/certificate PDF
- `policy` — open-inside-app-only flags

**Mobile must:**

1. Authorize on the server before every download/open when online.
2. Store ciphertext only in app-private storage.
3. Open only via internal PDF/video viewers.
4. Never Share / Print / Open With / save to public Downloads.
5. Treat delivery URLs as ephemeral; do not log them.

## Still required from backend/providers (not claimed done)

| Item | Status |
|---|---|
| Object storage streaming of encrypted PDF/video bytes | Placeholder metadata only (`PROTECTED_CONTENT_BASE_URL`) |
| Production Widevine / FairPlay packaging + license service | Adapter fields exist; seed video has `drmScheme: none` |
| Certificate PDF renderer / hash pipeline | Issue stores storage key + optional sha256; no PDF binary generation |
| OTP / Google / refresh-token auth flows | Not implemented (`register`/`login` password only) |
| Payments / checkout / live classes / notifications | Not in this slice |

## Env vars

See `apps/api/.env.example`:

- `LEARNER_JWT_SECRET`
- `OFFLINE_GRANT_SECRET` / `OFFLINE_GRANT_KID`
- `PROTECTED_CONTENT_BASE_URL`
- `OFFLINE_DOCUMENT_TTL_SECONDS` / `OFFLINE_VIDEO_TTL_SECONDS`

Never ship `OFFLINE_GRANT_SECRET` or storage credentials to the mobile app.
