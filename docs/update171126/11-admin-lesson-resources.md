# Handover 11 — Admin: add lesson resources (course · semester · video)

Admin-web spec for attaching learning materials to the right place in the curriculum. When staff add a resource, they always choose **which course**, then **which semester** (if the course is a semester track), then **which video / lesson** it belongs to.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff create resources in the admin panel; learners receive them on `GET /lessons/{id}` as `resources[]`, and open protected files via `POST /resources/{id}/download-authorization`.

Related: [10-admin-courses-pricing](./10-admin-courses-pricing.md) (course / semester arrange), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §12, types: `LessonResource` in `src/core/types.ts`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Put a file on a specific lesson video | Cascading placement: **Course → Semester → Video (lesson)** |
| Skip semester when not needed | Semester picker appears **only** for semester-track courses |
| Know what learners will see | Preview: video → Lesson Player; PDF/notes → Docs tab |
| Find existing files | List filterable by course, semester, lesson, kind, lifecycle |

A resource is **never** orphaned at course level. It always belongs to one **lesson** (the “video” row in the curriculum). Course and semester are how staff navigate to that lesson.

---

## Placement model

```
Course
  └─ [Semester]          ← only when deliveryType = semester_certification
        └─ Lesson / Video   ← required parent of every resource
              └─ Resource(s)  ← pdf | video | notes | audio | other
```

| Course type | Semester field | Video / lesson field |
|---|---|---|
| Standard | Hidden / N/A | Required — pick lesson in that course |
| Semester track | Required — pick Sem 1…N | Required — pick lesson **inside** that semester |

Do not allow free-typed course/semester/lesson IDs. Staff pick from published (or draft) curriculum lists only.

---

## Admin screen: Resources

Build `/admin/resources` (list) and `/admin/resources/new` + `/admin/resources/:id` (create / edit).

Also allow **Add resource** from inside:

- Course edit → Lessons tab → lesson row
- Semester detail → lesson row  
  (same form; course / semester / lesson pre-filled and locked)

### List columns (minimal)

| Column | Shows |
|---|---|
| Title | Resource title |
| Kind | `pdf` · `video` · `notes` · `audio` · `other` |
| Course | Course title |
| Semester | Semester title, or `—` for standard courses |
| Video / Lesson | Parent lesson title (+ index) |
| Download | Allowed / Not allowed |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, archive |

Filter chips: All · PDF · Video · Notes · Audio · Other.  
Filters: Course · Semester · Lesson · Lifecycle.  
Search by title. Default sort = newest first, or by lesson order when a course/lesson filter is active.

---

## Create / edit form — Placement (required UX)

```
Placement
  Course *          [ Search / pick course…          ▼ ]
  Semester          [ Sem 2 — Intermediate           ▼ ]   ← shown only for semester tracks
  Video / Lesson *  [ 04 — Working with Ledgers      ▼ ]

Resource
  Title *           [ Working with Ledgers — notes     ]
  Kind *            ( ○ PDF ) ( ● Video ) ( ○ Notes ) ( ○ Audio ) ( ○ Other )
  File / media *    [ Upload or pick from Media library ]
  Can download      [ ✓ ]   ← PDFs: usually on; primary video: usually off
  Sort order        [ 10 ]
  Lifecycle         Draft / Published / Archived
```

### Cascading picker rules

1. **Course** first. Changing course clears Semester and Video / Lesson.
2. If the course is **standard**, hide Semester and load that course’s lessons into Video / Lesson.
3. If the course is **semester track**, require Semester. Changing semester clears Video / Lesson and reloads only lessons in that semester.
4. **Video / Lesson** is required before save. Empty lesson list → block save with “Add a lesson to this course/semester first.”
5. Prefill from deep links (`?courseId=&semesterId=&lessonId=`) when opened from the curriculum builder.

### Kind behaviour (match learner app)

| Kind | Learner surface | Notes for admin |
|---|---|---|
| `video` | Lesson Player main player | Prefer **one primary video** per lesson. Extra videos allowed but only the first/primary drives playback. |
| `pdf` | Docs tab + optional Save PDF | Only PDF can be saved offline in the current mobile build. |
| `notes` | Docs tab | Text/HTML or attached notes file; not offline-saved as PDF. |
| `audio` | Docs / media open | Same download-authorization path. |
| `other` | Docs tab | Fallback MIME; open in Protected Viewer when possible. |

Primary video recommendation in UI:

> “This lesson already has a primary video. Add as secondary media, or replace the primary?”

---

## Resource fields

| Field | Required | Purpose |
|---|---|---|
| `id` | yes (server) | Stable resource identity. Never change after publish |
| `lessonId` | yes | Parent lesson (video). Implies course (+ semester via curriculum) |
| `title` | yes | Shown on Docs list / player chrome |
| `kind` | yes | `pdf` \| `video` \| `notes` \| `audio` \| `other` |
| `mimeType` | yes | e.g. `application/pdf`, `application/vnd.apple.mpegurl`, `video/mp4` |
| `sizeBytes` | no | Display + quota hints |
| `canDownload` | yes | Maps to learner `canDownload`. PDF offline only when `true` and policy allows |
| `mediaAssetId` | yes | Pointer to processed media in object storage |
| `sortOrder` | yes | Order inside the lesson’s `resources[]` |
| `checksumSha256` | no | Optional integrity for download grants |
| `captionsAssetId` | no | For `video` / `audio` |
| `lifecycle` | yes | Only `published` resources appear on learner lesson detail |
| `offlineUntilPolicy` | no | Max offline window for download grants (PDF) |

Derived for list/UI only (do not store as source of truth if already on the lesson/course):

- `courseId`, `courseTitle`
- `semesterId`, `semesterTitle` (null for standard)
- `lessonTitle`, `lessonIndex`

---

## Payload learners already expect

From `GET /lessons/{id}` (mapped in `httpRepositories`):

```json
{
  "id": "lesson-tally-04",
  "courseId": "course-tally-prime-cert",
  "title": "Working with Ledgers",
  "index": 4,
  "hasMedia": true,
  "resources": [
    {
      "id": "res-tally-04-video",
      "title": "Working with Ledgers",
      "kind": "video",
      "mimeType": "application/vnd.apple.mpegurl",
      "sizeBytes": 185000000,
      "canDownload": false
    },
    {
      "id": "res-tally-04-notes",
      "title": "Ledger practice sheet",
      "kind": "pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 420000,
      "canDownload": true
    }
  ]
}
```

App mapping (`LessonResource`):

| API field | App field |
|---|---|
| `id` | `id` |
| parent lesson | `lessonId` |
| `title` | `title` |
| `mimeType` | `mimeType` |
| `kind` | `kind` |
| `sizeBytes` | `sizeBytes` |
| `canDownload` | `canDownload` |

Playback and PDF open use `POST /resources/{id}/download-authorization` → short-lived HTTPS URL (never permanent public URLs in admin “copy link” for production media).

---

## Admin API (illustrative)

```
GET    /admin/resources?courseId=&semesterId=&lessonId=&kind=&lifecycle=
POST   /admin/resources
GET    /admin/resources/{id}
PATCH  /admin/resources/{id}
POST   /admin/resources/{id}/publish
POST   /admin/resources/{id}/archive
PATCH  /admin/lessons/{lessonId}/resources/reorder
```

### Create body

```json
{
  "lessonId": "lesson-tally-04",
  "title": "Ledger practice sheet",
  "kind": "pdf",
  "mediaAssetId": "media-abc123",
  "mimeType": "application/pdf",
  "canDownload": true,
  "sortOrder": 20,
  "lifecycle": "draft"
}
```

Server resolves `courseId` / `semesterId` from the lesson. Reject if `lessonId` is not under the course/semester the UI claimed (tamper check).

### Reorder

```
PATCH /admin/lessons/{lessonId}/resources/reorder
{ "orderedIds": ["res-video", "res-notes", "res-extra-pdf"] }
```

Primary video = first `kind: "video"` in this order (or an explicit `isPrimary` flag if you add one later).

---

## Publish & safety rules

1. Only `lifecycle: "published"` resources appear on learner `GET /lessons/{id}`.
2. Publishing a resource whose lesson/course is still draft does not expose it until the parent curriculum is published (or return it only in admin preview).
3. Do not delete a resource that has download history or that is the only primary video of a lesson with progress — **archive** instead.
4. Replacing the primary video must keep the same `resource.id` when possible so bookmarks / grants stay valid; otherwise archive the old row and attach a new one with an impact warning.
5. Changing `lessonId` (moving a resource to another video) is allowed only while draft, or with a confirm that progress/download grants stay on the resource id.
6. `canDownload: true` for non-PDF is stored but the current app only saves PDFs offline — show a staff hint, do not block.
7. Every create, move (lesson change), publish, archive, and reorder is audited.

---

## Admin module checklist

Staff can:

1. Open **Resources** and click **Add resource**.
2. Pick **Course** → (if semester track) **Semester** → **Video / Lesson**.
3. Upload or select media, set kind, title, download flag, order.
4. Save as draft; preview Docs / Player placement.
5. Publish; confirm the resource appears on learner lesson detail for entitled users.
6. Filter the list by course / semester / lesson / kind.
7. Add a resource from a lesson row with placement pre-filled.
8. Reorder resources on a lesson; first video remains the player source.

---

## Acceptance checklist

- [ ] Create form always requires Course and Video / Lesson.
- [ ] Semester picker shows only for semester-track courses and is required then.
- [ ] Changing Course or Semester clears dependent pickers.
- [ ] Saved resource has a stable `id` and `lessonId`; learner `GET /lessons/{id}` lists it when published.
- [ ] Video kind plays in Lesson Player; PDF/notes appear under Docs.
- [ ] PDF with `canDownload: true` can request download authorization; permanent public URLs are not used.
- [ ] Standard courses never require or store a semester on the resource path.
- [ ] Archive (not hard-delete) for resources tied to progress or download history.
- [ ] Create, move, publish, archive, and reorder are audited.

---

## Out of scope (this handover)

- Course pricing / Free ↔ Paid ([10](./10-admin-courses-pricing.md)).
- Semester approval / unlock queue.
- Explore section tiles.
- Live-class session resources (separate live module).
- DRM / offline video packaging.
