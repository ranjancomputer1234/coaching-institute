# Handover 6 — Interview Prep

Interview Prep needs categories and the questions inside them. Category ids and question `categoryId` values must match. An Explore section titled Interview Prep does not create questions.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /interview/categories`, `GET /interview/questions`, and `GET /interview/questions/{id}` return 404. The topic chips and the question list stay empty.

## Screen

`InterviewPrep` (`src/screens/interview/InterviewPrepScreen.tsx`), `InterviewQuestionList`, and `InterviewQuestion`.

- Chips come from `GET /interview/categories`.
- Questions come from `GET /interview/questions`. A chip filters with `categoryId`.
- The first three questions are the preview. "See all" stays on the device.
- A card shows the category title and opens `GET /interview/questions/{id}`.
- Detail shows `prompt` and `modelAnswer`.
- A category with `access.reason: "purchase_required"` does not open its question list.

Known chip short labels, used only when the category id matches:

| Category `id` | Chip label |
|---|---|
| `int-hr` | HR |
| `int-tech` | Technical |
| `int-gd` | Group discussion |
| `int-apt` | Aptitude |
| `int-mock` | Mock interview |
| `int-resume` | Resume |

Any other id uses `title` as the chip label. Prefer these ids when the admin seeds the same topics.

## Categories

`GET /interview/categories`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

```json
{
  "items": [
    {
      "id": "int-hr",
      "title": "HR questions",
      "summary": "Introductions and behaviour",
      "pricing": "free",
      "iconKey": "users",
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
| `id` | yes | Chip id. Questions must send this as `categoryId` |
| `title` or `name` | yes | Chip label when the id is not in the short-label table |
| `summary`, `subtitle`, or `description` | no | Category subtitle |
| `pricing` | no | Defaults to free |
| `access` | no | `reason: "purchase_required"` blocks the question list |

If this route is missing, the app builds one chip per distinct `categoryId` on the question list, and the chip title becomes that raw id. Publish categories so learners see names.

## Question list

`GET /interview/questions`

Query: `categoryId` optional. Omit it on the Interview Prep home so every published question is available for search and the warmup button.

```json
[
  {
    "id": "q-tell-me",
    "categoryId": "int-hr",
    "prompt": "Tell me about yourself.",
    "modelAnswer": "Present role, one proof point, and why this job."
  }
]
```

A page object with `items` is also accepted.

| Field | Required | App use |
|---|---|---|
| `id` | yes | Question route |
| `categoryId` | yes | Must match a category `id`. The chip filter compares this exactly |
| `prompt`, `question`, or `title` | yes | Card and detail question. `prompt` wins |
| `modelAnswer` or `answer` | no | Detail answer. Empty shows a generic practice hint |

Do not send the model answer only on the detail route if the list already includes it. The list screen does not print it, but the same mapper is used for both.

## Question detail

`GET /interview/questions/{id}`

One object with the same fields. This is the payload the answer screen renders.

## Publish rules

- Only published categories and published questions.
- Every question `categoryId` must exist in `GET /interview/categories`.
- Keep ids stable. The app routes by id, not by title.
- A paid mock-interview category can use `access.granted: false` and `reason: "purchase_required"`. Leave free HR and technical questions granted for guests.
- This screen does not book a human interviewer. A mock category is still a list of questions unless the admin later maps it to a product.
