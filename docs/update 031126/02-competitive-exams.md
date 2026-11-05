# Handover 2 — Competitive Exam

The Competitive Exam screen lists published exams and the tests attached to them. Explore section rows from `GET /home` or `GET /categories` are only navigation tiles. They do not fill this list.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /exams`, `GET /exams/{id}`, and `GET /tests` all return 404. The screen therefore stays empty. Publishing an Explore section titled Competitive Exams does not add exams.

## Screen

`CompetitiveExams` (`src/screens/exams/CompetitiveExamsScreen.tsx`)

- Search sends `search`. Chips send `pricing=free` or `pricing=paid`.
- Each exam card shows title, FREE or PAID, description, test count, and learner count.
- A free practice test whose title contains "daily", or any free test with `mode: "practice"`, is the daily-test button.
- Tap an exam opens `GET /exams/{id}` and `GET /tests?examId=`.

## Exam list

`GET /exams`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

```json
{
  "items": [
    {
      "id": "exam-ssc",
      "title": "SSC CGL",
      "summary": "Tier 1 practice",
      "description": "Syllabus, guided practice and mock tests",
      "pricing": "free",
      "commercialMode": "free",
      "iconKey": "target",
      "themeKey": "purple",
      "imageUrl": null,
      "testCount": 12,
      "learnerCount": 2400,
      "relatedExams": ["Banking", "Railways"],
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

| Field | Required | App use |
|---|---|---|
| `id` | yes | Card id and exam detail route |
| `title` | yes | Card title and search |
| `summary`, `subtitle`, or `description` | no | Card subtitle. Detail prefers `description`, then `summary` |
| `pricing` or `commercialMode` | yes | `paid` or `commercialMode: "paid"` shows PAID. Otherwise FREE |
| `iconKey` | no | Bundled icon name. Unknown names fall back to `target` |
| `testCount` | no | "12 tests". Missing shows "Practice sets" |
| `learnerCount` | no | Shown only when greater than 0 |
| `relatedExams` | no | String array, up to two labels on the card |
| `access` | no | Same shape as courses. Locked exams stay visible |

A bare array is accepted. `search` matches title and summary on the server. Only published exams.

## Exam detail

`GET /exams/{id}`

Same object as a list row. `description` is the syllabus introduction. `relatedExams` links other exam ids or labels the admin wants shown.

Return 404 when the exam is missing, draft, or archived. The app shows an error with retry for that case.

## Tests

`GET /tests`

Query: `examId` when the learner opened one exam. Omit `examId` for the full practice list used on the Competitive Exam home.

```json
[
  {
    "id": "test-daily",
    "examId": "exam-ssc",
    "title": "Daily current affairs",
    "questionCount": 10,
    "durationMinutes": 15,
    "pricing": "free",
    "mode": "practice",
    "marking": "+1",
    "negativeMarking": "0",
    "passThreshold": 40,
    "attemptLimit": null,
    "access": {
      "granted": true,
      "canPreview": true,
      "canDownload": false
    }
  }
]
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Opens test instructions |
| `examId` | yes when the test belongs to an exam | Detail screen filters with this |
| `title` | yes | Daily button matches `/daily/i` on a free test |
| `questionCount` | yes | "10 questions" |
| `durationMinutes` or `durationSeconds` | yes | Shown as the test length |
| `pricing` | yes | `free` or `paid` |
| `mode` | yes | `practice` or `formal`. The daily fallback is a free `practice` test |
| `access` | no | Paid tests stay listed and open the purchase or login state |

`GET /tests/{id}` returns one test, including the same fields, before an attempt starts.

## Publish rules

- An exam with zero tests is still listed. `testCount` should be 0 or omitted.
- Every test row used by this screen must include `examId` so exam detail can filter it.
- Do not return draft questions inside `GET /tests`. Question bodies belong to the attempt APIs after `POST /tests/{id}/attempts`.
