# Handover 1 — Computer Courses

The Computer Courses screen lists every published course from the admin panel. It does not read Explore section records, and it does not use `GET /home` featured courses once `GET /courses` exists.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`. Publish in the admin panel, then expose the same published rows on the learner routes below.

## What is live today

| Route | Result |
|---|---|
| `GET /courses` | 404, so the screen can only fall back to featured courses on `GET /home` |
| `GET /courses/{id}` | Works for a published course such as Tally Prime Basics |
| `GET /courses/{id}/lessons` | Works |
| `GET /search?q=` | Finds courses by text, not a full catalogue |

Until `GET /courses` returns the list below, courses that are published but not featured stay hidden.

## Screen

`ComputerCourses` (`src/screens/catalog/CatalogScreen.tsx`)

- Search box sends `search`.
- Chips send `pricing=free` or `pricing=paid`. `All` omits `pricing`.
- Each card shows `title`, a FREE or PAID badge, and `iconUrl` or the first letter of `shortTitle`.
- Tap opens `GET /courses/{id}` and `GET /courses/{id}/lessons`.

## List

`GET /courses`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

Return a JSON array, or a page:

```json
{
  "items": [
    {
      "id": "cmveuksfd0018v3t4bw7s4bu1",
      "slug": "tally-prime-basics",
      "title": "Tally Prime Basics",
      "shortTitle": "Tally",
      "summary": "Introductory Tally Prime course",
      "commercialMode": "free",
      "coverImageUrl": null,
      "iconUrl": null,
      "estimatedMinutes": 90,
      "access": {
        "granted": true,
        "canPreview": true,
        "canDownload": false
      }
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

Fields the app reads:

| Field | Required | App use |
|---|---|---|
| `id` | yes | Card id and course detail route |
| `title` | yes | Card title |
| `commercialMode` | yes | `free` shows FREE. Every other mode shows PAID |
| `shortTitle` | no | Letter on the card when `iconUrl` is empty |
| `summary` or `shortTitle` | no | Stored as the subtitle |
| `iconUrl` | no | Raster icon on the card. HTTPS URL |
| `coverImageUrl` | no | Detail artwork |
| `description` | no | Detail body. `summary` is used when this is empty |
| `access` | no | Guests on a free course are treated as granted. Paid courses without access are `purchase_required`, or `login_required` when there is no token |

`commercialMode` values: `free`, `paid`, `included`, `invite_only`, `hidden_internal`. Do not put `hidden_internal` or unpublished rows in this list.

`pricing` on the query must be applied by the server. `search` matches title and summary. `nextCursor` is null on the last page. The app also accepts a bare array with no page wrapper.

## Detail

`GET /courses/{id}` for guests. `GET /courses/{id}/access` when a bearer token is present.

Same course object as a list row, plus:

```json
{
  "id": "cmveuksfd0018v3t4bw7s4bu1",
  "title": "Tally Prime Basics",
  "summary": "Introductory Tally Prime course",
  "description": "What the learner will practice.",
  "commercialMode": "free",
  "deliveryType": "standard",
  "coverImageUrl": null,
  "lessons": [],
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "source": null
  }
}
```

`deliveryType`: `standard` or `semester_certification`. `access.source = "enrollment"` marks the learner as enrolled.

## Lessons

`GET /courses/{id}/lessons`

```json
[
  {
    "id": "lesson-id",
    "courseId": "cmveuksfd0018v3t4bw7s4bu1",
    "title": "Getting started",
    "description": "Optional notes",
    "sortOrder": 0,
    "durationMinutes": 12,
    "contentType": "video",
    "isPreview": true
  }
]
```

`sortOrder` is zero-based. The app displays `sortOrder + 1`. `isPreview: true` stays open for learners who have not purchased. Other lessons on a locked course are locked.

## Enroll

`POST /courses/{id}/enroll` with `Authorization: Bearer`. Empty body. Return the enrollment row. Guests are not enrolled by the app.

## Publish rules

- Only `published` courses appear.
- A course with no lessons can still appear in the list. Detail then shows an empty lesson list.
- Free courses must return `commercialMode: "free"` and granted preview access for guests.
- Paid courses stay in the list with a PAID badge. Do not hide them. Deny the body with `access.granted: false` and `reason: "purchase_required"` or `"login_required"`.
