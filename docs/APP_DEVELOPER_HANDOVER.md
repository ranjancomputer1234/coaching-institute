# REDI learner app — API handover

Handover for the mobile / learner app. Every path below is implemented in `apps/api` and is prefixed with `/api`.

Admin panel routes (`/api/admin/...`) are a separate product. They use a different login and JWT. Do not call them from the learner app.

## Base URL and headers

| Environment | Base URL |
|---|---|
| Local | `http://localhost:3333/api` |

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <accessToken>
```

Send `Authorization` only on routes marked **Auth: learner**. Unknown JSON fields are rejected (`400`).

Learner tokens expire in **30 days** (`LEARNER_JWT_EXPIRES_IN`). The payload is `{ sub, email, typ: "learner" }`. An admin token will not open these routes.

Logout is client-side: discard the token. The server does not keep a session blocklist.

## Seed accounts (local)

After `prisma db seed` in `apps/api`:

| Email | Password | Notes |
|---|---|---|
| `riya@learner.local` | `learner123` | Enrolled in Tally Prime Basics, has an admit card and a course entitlement |
| `arjun@learner.local` | `learner123` | Active learner, no seeded entitlement |

Seed also prints the PDF resource id, video resource id, and related ids. Use those real ids in place of the placeholders below (`crs_tally`, `lsn_start`, `res_pdf`, `res_video`, `doc_admit`).

## Errors

The HTTP status is on the response. Business-error JSON does not repeat `statusCode`:

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid email or password",
  "fieldErrors": {}
}
```

Validation errors (missing field, password shorter than 6, bad email) use Nest’s default shape:

```json
{
  "statusCode": 400,
  "message": ["password must be longer than or equal to 6 characters"],
  "error": "Bad Request"
}
```

| HTTP | `code` | When |
|---|---|---|
| 400 | `EMAIL_IN_USE` | Register with an email that already exists. `fieldErrors.email` is `"taken"` |
| 401 | `UNAUTHORIZED` | Bad password, missing/invalid learner JWT, or account `suspended` / `blocked` / `deleted` |
| 403 | `ACCESS_DENIED` | Enroll or download without an active entitlement. Download responses may also include `entitlement` |
| 403 | `DOCUMENT_REVOKED` | Resource is tied to a revoked, superseded, or not-issued document |
| 403 | `DELIVERY_EXPIRED` | Delivery token missing, wrong resource, revoked, or past `expiresAt` |
| 404 | `NOT_FOUND` | Course, lesson, resource, or document id is unknown or not published |

## Suggested app flow

1. `POST /auth/login` (or `/auth/register`) and store `accessToken`.
2. `GET /home` for guests, `GET /home/me` once signed in.
3. Open a course with `GET /courses/:id`. Signed-in users can call `GET /courses/:id/access` for the entitlement projection.
4. Free courses, or paid courses with `access.granted`, call `POST /courses/:id/enroll`.
5. List lessons, open a lesson, then `POST /lessons/:id/progress` and `POST /lessons/:id/complete`.
6. Documents: `GET /me/documents`, then `GET /me/documents/:id`. Download only through `POST /resources/:id/download-authorization`.
7. Play or save the short-lived `delivery.url`. Keep offline content only inside app-private storage, and re-check the signed grant with `GET /crypto/offline-verification`.

---

## Endpoint index

| Auth | Method | Path |
|---|---|---|
| Public | POST | `/auth/register` |
| Public | POST | `/auth/login` |
| Public | POST | `/auth/logout` |
| Learner | GET | `/me` |
| Learner | PATCH | `/me` |
| Public | GET | `/home` |
| Learner | GET | `/home/me` |
| Public | GET | `/categories` |
| Public | GET | `/search?q=` |
| Public | GET | `/courses/:id` |
| Learner | GET | `/courses/:id/access` |
| Learner | POST | `/courses/:id/enroll` |
| Public | GET | `/courses/:id/lessons` |
| Public | GET | `/lessons/:id` |
| Learner | POST | `/lessons/:id/progress` |
| Learner | POST | `/lessons/:id/complete` |
| Learner | GET | `/me/enrollments` |
| Learner | GET | `/me/entitlements` |
| Learner | GET | `/me/documents` |
| Learner | GET | `/me/documents/:id` |
| Public | GET | `/documents/verify/:token` |
| Learner | POST | `/resources/:id/download-authorization` |
| Public* | GET | `/protected/delivery/:resourceId?token=` |
| Public | GET | `/crypto/offline-verification` |

\*Delivery requires the one-time `token` from download authorization. There is no Bearer check on this route.

---

## Auth and profile

### POST `/auth/register`

Creates an active learner and returns a token. Email is stored lowercased.

**Request**

```json
{
  "firstName": "Riya",
  "lastName": "Sharma",
  "email": "riya.new@learner.local",
  "password": "learner123",
  "phone": "9876543210",
  "city": "Patna"
}
```

`phone` and `city` are optional. `password` minimum length is 6.

**Response `201`**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
  "learner": {
    "id": "lrn_riya",
    "firstName": "Riya",
    "lastName": "Sharma",
    "email": "riya.new@learner.local",
    "phone": "9876543210",
    "city": "Patna",
    "accountState": "active",
    "verifiedEmail": true,
    "verifiedPhone": false,
    "appVersion": null,
    "batchId": null
  }
}
```

### POST `/auth/login`

**Request**

```json
{
  "email": "riya@learner.local",
  "password": "learner123"
}
```

**Response `201`** — same shape as register. Seeded Riya also has `verifiedPhone: true`, `city: "Patna"`, and `batchId: "seed-batch-redi"`.

### POST `/auth/logout`

No body. No auth required.

**Response `201`**

```json
{ "ok": true }
```

### GET `/me`

**Auth: learner**

**Response `200`**

```json
{
  "id": "lrn_riya",
  "firstName": "Riya",
  "lastName": "Sharma",
  "email": "riya@learner.local",
  "phone": "9876543210",
  "city": "Patna",
  "accountState": "active",
  "verifiedEmail": true,
  "verifiedPhone": true,
  "appVersion": "1.0.0",
  "batchId": "seed-batch-redi"
}
```

`accountState`: `pending_verification` | `active` | `suspended` | `deletion_requested` | `deleted` | `blocked`.

### PATCH `/me`

**Auth: learner.** Send only fields to change. Empty body is valid.

**Request**

```json
{
  "firstName": "Riya",
  "lastName": "Sharma",
  "phone": "9876543210",
  "city": "Patna",
  "appVersion": "1.4.2"
}
```

**Response `200`** — same profile object as `GET /me`.

---

## Home, catalogue, search

### GET `/home`

Public. Published banners (max 8), home-visible explore sections, featured courses (max 8). `continuing` is always `[]` on this route.

**Response `200`**

```json
{
  "banners": [
    {
      "id": "bnr_hero_1",
      "campaignName": "Tally launch",
      "title": "Start Tally Prime today",
      "subtitle": "Free introductory course",
      "ctaLabel": "Open course",
      "placement": "hero",
      "priority": 10,
      "imageUrl": "https://cdn.example.com/banners/tally-hero.jpg",
      "altText": "Tally Prime course banner",
      "themeKey": "indigo",
      "targetKind": "course",
      "targetRef": "crs_tally",
      "audienceJson": "{\"type\":\"everyone\"}",
      "lifecycle": "published",
      "startsAt": null,
      "endsAt": null,
      "locale": "en",
      "revision": 1,
      "publishedAt": "2026-04-01T06:30:00.000Z",
      "createdAt": "2026-04-01T06:30:00.000Z",
      "updatedAt": "2026-04-01T06:30:00.000Z"
    }
  ],
  "sections": [
    {
      "id": "sec_learn_tally",
      "slug": "tally-prime",
      "title": "Tally Prime",
      "description": "Accounts and GST basics",
      "badge": "Free",
      "category": "learn",
      "iconKey": "calculator",
      "themeKey": "teal",
      "imageUrl": null,
      "accessibilityLabel": "Tally Prime section",
      "targetKind": "course",
      "targetRef": "crs_tally",
      "pricingFilter": "all",
      "sortOrder": 0,
      "featured": true,
      "homeVisible": true,
      "lifecycle": "published",
      "startsAt": null,
      "endsAt": null,
      "minAppVersion": null,
      "locale": "en",
      "revision": 1,
      "publishedAt": "2026-04-01T06:30:00.000Z",
      "createdAt": "2026-04-01T06:30:00.000Z",
      "updatedAt": "2026-04-01T06:30:00.000Z"
    }
  ],
  "featuredCourses": [
    {
      "id": "crs_tally",
      "slug": "tally-prime-basics",
      "title": "Tally Prime Basics",
      "shortTitle": "Tally Free",
      "summary": "Introductory Tally Prime course",
      "commercialMode": "free",
      "estimatedMinutes": null,
      "coverImageUrl": null
    }
  ],
  "continuing": []
}
```

`placement`: `hero` | `compact` | `live_class` | `modal`.  
`category`: `learn` | `prepare` | `discover`.  
`targetKind` / `targetRef` tell the app where a tap should go (for example `course` + course id).

### GET `/home/me`

**Auth: learner.** Same payload as `/home`, plus up to 5 in-progress lessons.

```json
{
  "banners": [],
  "sections": [],
  "featuredCourses": [],
  "continuing": [
    {
      "lessonId": "lsn_start",
      "title": "Getting started",
      "courseId": "crs_tally",
      "courseTitle": "Tally Prime Basics",
      "progressPct": 40
    }
  ]
}
```

### GET `/categories`

Public. Published explore sections, ordered by category then `sortOrder`. Same section object as `home.sections`. Returns a JSON array.

### GET `/search?q=`

Public. Empty or whitespace `q` returns `{ "courses": [], "lessons": [] }`. Otherwise up to 20 of each. Match is case-sensitive `contains` on course title, summary, slug, and lesson title.

**Example:** `GET /search?q=Tally`

```json
{
  "courses": [
    {
      "id": "crs_tally",
      "slug": "tally-prime-basics",
      "title": "Tally Prime Basics",
      "summary": "Introductory Tally Prime course",
      "commercialMode": "free"
    }
  ],
  "lessons": [
    {
      "id": "lsn_start",
      "title": "Getting started",
      "courseId": "crs_tally",
      "course": { "title": "Tally Prime Basics" }
    }
  ]
}
```

---

## Courses, lessons, progress

`commercialMode`: `free` | `paid` | `included` | `invite_only` | `hidden_internal`.

Only `lifecycle: published` courses and lessons are returned. Lesson `contentType` is a string; seeded lessons use `"video"`.

### GET `/courses/:id`

Public course detail. `access` is `null` because this route does not know the learner.

**Response `200`**

```json
{
  "id": "crs_tally",
  "slug": "tally-prime-basics",
  "title": "Tally Prime Basics",
  "shortTitle": "Tally Free",
  "summary": "Introductory Tally Prime course",
  "description": null,
  "language": "en",
  "level": null,
  "tagsJson": "[]",
  "deliveryType": "standard",
  "commercialMode": "free",
  "lifecycle": "published",
  "featured": true,
  "estimatedMinutes": null,
  "coverImageUrl": null,
  "revision": 1,
  "publishedAt": "2026-04-01T06:30:00.000Z",
  "createdAt": "2026-04-01T06:30:00.000Z",
  "updatedAt": "2026-04-01T06:30:00.000Z",
  "lessons": [
    {
      "id": "lsn_start",
      "title": "Getting started",
      "description": null,
      "sortOrder": 0,
      "durationMinutes": 12,
      "contentType": "video",
      "isPreview": true
    }
  ],
  "access": null
}
```

`deliveryType`: `standard` | `semester_certification`.

### GET `/courses/:id/access`

**Auth: learner.** Same course object, with `access` filled in.

Free course:

```json
{
  "granted": true,
  "reason": null,
  "canDownload": true,
  "canPreview": true,
  "expiresAt": null,
  "source": "free_course"
}
```

Paid course the learner is enrolled in uses `source: "enrollment"` and may set `expiresAt`. An active entitlement uses `source: "entitlement"`. Denied access:

```json
{
  "granted": false,
  "reason": "entitlement_required",
  "canDownload": false,
  "canPreview": false,
  "expiresAt": null,
  "source": null
}
```

Other `reason` values include `course_unavailable`.

### POST `/courses/:id/enroll`

**Auth: learner.** No body.

Free courses enroll with `source: "self_enroll"`. Paid courses enroll only when `access.granted` is already true (`source: "entitlement"`). Calling again reactivates the same row (`status: "active"`).

**Response `201`**

```json
{
  "id": "enr_riya_tally",
  "learnerId": "lrn_riya",
  "courseId": "crs_tally",
  "source": "self_enroll",
  "status": "active",
  "startsAt": "2026-10-04T00:00:00.000Z",
  "endsAt": null,
  "createdAt": "2026-10-04T00:00:00.000Z",
  "updatedAt": "2026-10-04T00:00:00.000Z"
}
```

**Response `403`** when a paid course has no grant:

```json
{
  "code": "ACCESS_DENIED",
  "message": "Enrollment requires an active entitlement",
  "fieldErrors": {}
}
```

### GET `/courses/:id/lessons`

Public. `404` if the course is missing. Array of published lessons, same lesson fields as `course.lessons`, ordered by `sortOrder`.

### GET `/lessons/:id`

Public metadata. The raw `mediaUrl` is never returned. Use `hasMedia` and, when the learner may download, the resource authorization endpoint.

**Response `200`**

```json
{
  "id": "lsn_start",
  "courseId": "crs_tally",
  "title": "Getting started",
  "description": null,
  "sortOrder": 0,
  "durationMinutes": 12,
  "contentType": "video",
  "isPreview": true,
  "hasMedia": false
}
```

### POST `/lessons/:id/progress`

**Auth: learner.** Both fields optional. `progressPct` is 0–100. `positionSeconds` is an integer ≥ 0.

**Request**

```json
{
  "progressPct": 40,
  "positionSeconds": 125
}
```

**Response `201`**

```json
{
  "id": "prg_riya_start",
  "learnerId": "lrn_riya",
  "lessonId": "lsn_start",
  "status": "in_progress",
  "progressPct": 40,
  "positionSeconds": 125,
  "completedAt": null,
  "updatedAt": "2026-10-04T01:10:00.000Z",
  "createdAt": "2026-10-04T01:00:00.000Z"
}
```

Sending progress again keeps `status` at `in_progress` even if the lesson was previously completed.

### POST `/lessons/:id/complete`

**Auth: learner.** No body.

**Response `201`**

```json
{
  "id": "prg_riya_start",
  "learnerId": "lrn_riya",
  "lessonId": "lsn_start",
  "status": "completed",
  "progressPct": 100,
  "positionSeconds": 125,
  "completedAt": "2026-10-04T01:20:00.000Z",
  "updatedAt": "2026-10-04T01:20:00.000Z",
  "createdAt": "2026-10-04T01:00:00.000Z"
}
```

### GET `/me/enrollments`

**Auth: learner.** Newest first.

```json
[
  {
    "id": "enr_riya_tally",
    "learnerId": "lrn_riya",
    "courseId": "crs_tally",
    "source": "manual",
    "status": "active",
    "startsAt": "2026-01-15T00:00:00.000Z",
    "endsAt": null,
    "createdAt": "2026-01-15T00:00:00.000Z",
    "updatedAt": "2026-01-15T00:00:00.000Z",
    "course": {
      "id": "crs_tally",
      "title": "Tally Prime Basics",
      "slug": "tally-prime-basics",
      "lifecycle": "published"
    }
  }
]
```

`source` examples: `manual`, `self_enroll`, `entitlement`. `status` is a string; the app should treat `"active"` as the open enrollment.

### GET `/me/entitlements`

**Auth: learner.** Newest first. Riya’s seed row:

```json
[
  {
    "id": "ent_riya_tally",
    "learnerId": "lrn_riya",
    "courseId": "crs_tally",
    "productKey": null,
    "scopeKind": "course",
    "scopeRef": "crs_tally",
    "source": "enrollment",
    "state": "active",
    "canDownload": true,
    "canPreview": true,
    "startsAt": "2026-01-15T00:00:00.000Z",
    "endsAt": null,
    "grantReason": null,
    "revokeReason": null,
    "createdAt": "2026-01-15T00:00:00.000Z",
    "updatedAt": "2026-01-15T00:00:00.000Z"
  }
]
```

`state`: `active` | `expired` | `revoked` | `pending`.  
`scopeKind`: `course` | `resource` | `document`.  
`source` examples: `purchase`, `manual`, `scholarship`, `promotion`, `enrollment`.

---

## Documents

Issued files are not attached to these responses. The detail route points at download authorization. PDFs must open inside the app.

`documentType`: `admit_card` | `certificate` | `receipt`.  
`status`: `not_issued` | `generation_pending` | `generated` | `approval_pending` | `issued` | `revoked` | `superseded` | `expired` | `generation_failed`.

### GET `/me/documents`

**Auth: learner.**

```json
[
  {
    "id": "doc_admit",
    "documentType": "admit_card",
    "status": "issued",
    "serial": "AC-SEED-001",
    "title": "Tally Formal Test Admit Card",
    "courseId": "crs_tally",
    "resourceId": "res_admit_pdf",
    "issuedAt": "2026-03-01T04:00:00.000Z",
    "expiresAt": null,
    "revokedAt": null,
    "updatedAt": "2026-03-01T04:00:00.000Z"
  }
]
```

### GET `/me/documents/:id`

**Auth: learner.** Adds the verification token and a download pointer. `shareForbidden` is always true.

```json
{
  "id": "doc_admit",
  "documentType": "admit_card",
  "status": "issued",
  "serial": "AC-SEED-001",
  "title": "Tally Formal Test Admit Card",
  "courseId": "crs_tally",
  "resourceId": "res_admit_pdf",
  "issuedAt": "2026-03-01T04:00:00.000Z",
  "expiresAt": null,
  "revokedAt": null,
  "verificationToken": "clverifytoken001",
  "updatedAt": "2026-03-01T04:00:00.000Z",
  "download": {
    "resourceId": "res_admit_pdf",
    "path": "POST /api/resources/res_admit_pdf/download-authorization",
    "openInsideAppOnly": true
  },
  "shareForbidden": true
}
```

If `resourceId` is null, `download` is null.

### GET `/documents/verify/:token`

Public. Safe to open from a QR code. Does not return phone, email, scores, or file bytes. Unknown token:

```json
{
  "valid": false,
  "status": "invalid",
  "message": "Verification token not recognized"
}
```

Issued document (`valid` is true only when `status` is `issued`):

```json
{
  "valid": true,
  "status": "issued",
  "documentType": "admit_card",
  "title": "Tally Formal Test Admit Card",
  "serial": "AC-SEED-001",
  "issuedAt": "2026-03-01T04:00:00.000Z",
  "issuer": "Ranjan Educational Institute",
  "identity": { "displayName": "Riya S." }
}
```

---

## Protected downloads

Call authorization while online before every open or download. Store ciphertext only in app-private storage. Do not share, export, print, or place the file on public storage. Do not persist `delivery.url` beyond `delivery.expiresAt` (default **15 minutes**).

Offline grant lifetimes: documents **7 days**, video **3 days** (server env can change these).

### POST `/resources/:id/download-authorization`

**Auth: learner.**

**Request** (both fields optional)

```json
{
  "deviceId": "android-pixel-8-abc",
  "installationId": "install-9f3a"
}
```

**Response `201` — PDF notes (seed: “Tally Getting Started Notes (PDF)”)**

```json
{
  "resourceId": "res_pdf",
  "kind": "pdf",
  "title": "Tally Getting Started Notes (PDF)",
  "mimeType": "application/pdf",
  "byteSize": 245760,
  "contentVersion": 1,
  "parent": {
    "courseId": "crs_tally",
    "lessonId": "lsn_start"
  },
  "entitlement": {
    "granted": true,
    "download": true,
    "preview": false,
    "reason": null,
    "expiresAt": null,
    "source": "free_course"
  },
  "delivery": {
    "method": "https",
    "url": "http://localhost:3333/api/protected/delivery/res_pdf?token=dlv_one_time_token",
    "expiresAt": "2026-10-04T01:55:00.000Z",
    "integrity": {
      "algo": "sha256",
      "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    "encryption": {
      "algo": "aes-256-gcm",
      "packagingFormat": "encrypted_pdf"
    },
    "exportForbidden": true
  },
  "offlineAuthorization": {
    "grantId": "grn_001",
    "scope": {
      "accountId": "lrn_riya",
      "resourceId": "res_pdf",
      "contentVersion": 1,
      "deviceId": "android-pixel-8-abc"
    },
    "validFrom": "2026-10-04T01:40:00.000Z",
    "validUntil": "2026-10-11T01:40:00.000Z",
    "kid": "redi-offline-v1",
    "signature": "base64url-hmac-sha256",
    "payload": {
      "grantId": "grn_001",
      "accountId": "lrn_riya",
      "resourceId": "res_pdf",
      "contentVersion": 1,
      "deviceId": "android-pixel-8-abc",
      "validFrom": "2026-10-04T01:40:00.000Z",
      "validUntil": "2026-10-11T01:40:00.000Z",
      "kid": "redi-offline-v1"
    }
  },
  "drm": null,
  "document": null,
  "policy": {
    "openInsideAppOnly": true,
    "shareExportPrintForbidden": true,
    "publicStorageForbidden": true
  }
}
```

`kind`: `pdf` | `video` | `audio` | `notes` | `other`.

`signature` is HMAC-SHA256 (base64url) over `JSON.stringify(payload)` with the server secret for `kid`. The app receives the signature. It does not receive the secret.

**Video** (`kind: "video"`) sets `drm` instead of `null`. Seeded video has no Widevine/FairPlay ids yet:

```json
{
  "scheme": "none",
  "contentId": null,
  "licenseUrl": null,
  "offlineAllowed": false,
  "offlinePeriodSeconds": null,
  "status": "provider_configuration_required",
  "message": "Protected offline video requires Widevine/FairPlay packaging and a license service. Adapter contract is ready; production DRM is not claimed until configured."
}
```

When DRM is configured, `status` is `"ready"` and the object includes `scheme` (`widevine` | `fairplay` | `provider`), `contentId`, `licenseUrl`, `offlineAllowed: true`, and `offlinePeriodSeconds`.

**Admit card / certificate** resources also fill `document`:

```json
{
  "id": "doc_admit",
  "documentType": "admit_card",
  "status": "issued",
  "serial": "AC-SEED-001",
  "issuedAt": "2026-03-01T04:00:00.000Z",
  "expiresAt": null
}
```

**Response `403`** when download is not allowed:

```json
{
  "code": "ACCESS_DENIED",
  "message": "Download not permitted",
  "fieldErrors": {},
  "entitlement": {
    "granted": false,
    "reason": "entitlement_required",
    "canDownload": false,
    "canPreview": false,
    "expiresAt": null,
    "source": null
  }
}
```

### GET `/protected/delivery/:resourceId?token=`

No Bearer token. `token` is the query value inside `delivery.url`. The session is single-purpose and expires with the authorization.

Until object storage is connected, this returns metadata, not file bytes.

**Response `200`**

```json
{
  "resourceId": "res_pdf",
  "storageKey": "seed/tally-getting-started.pdf.enc",
  "mimeType": "application/pdf",
  "contentVersion": 1,
  "encryptionAlgo": "aes-256-gcm",
  "packagingFormat": "encrypted_pdf",
  "checksumSha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "status": "metadata_only_until_storage_wired",
  "note": "Wire PROTECTED_CONTENT storage provider to stream ciphertext bytes. Do not redirect to a public CDN URL for protected resources."
}
```

`status` is `missing_media_asset` when the resource has no media row. Do not treat `storageKey` as a public URL.

**Response `403`**

```json
{
  "code": "DELIVERY_EXPIRED",
  "message": "Download session is invalid or expired",
  "fieldErrors": {}
}
```

### GET `/crypto/offline-verification`

Public. Confirms which key id and algorithm signed `offlineAuthorization`. The HMAC secret stays on the server.

```json
{
  "kid": "redi-offline-v1",
  "algorithm": "HMAC-SHA256",
  "note": "Verify offlineAuthorization.signature over the canonical payload JSON using the server-held secret matching this kid. Mobile apps receive signed grants; they do not receive the HMAC secret.",
  "status": "configured"
}
```

`status` is `using_dev_fallback` when `OFFLINE_GRANT_SECRET` is unset.

---

## What the learner app does not call

Tests, attempts, results, projects, live classes, orders, coupons, notifications, and staff management are admin-only today (`/api/admin/...`). There is no learner exam or payment API in this build.

Staff login, if you ever need it for a debug tool, is `POST /api/admin/auth/login` with `{ "email": "admin@institute.local", "password": "admin123" }`. That token must not be sent to `/me`, `/home/me`, or download routes.
