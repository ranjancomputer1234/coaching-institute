# Handover 16 — Admin: Interview Prep (categories & questions)

Admin-web spec so staff can **create, edit, and publish** Interview Prep **categories** and **questions** (prompt, model answer, tips, order, Free·Paid access) — matching what the learner app already renders on `InterviewPrep`, `InterviewQuestionList`, and `InterviewQuestion`.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage content in admin; learners read published rows from `GET /interview/categories`, `GET /interview/questions`, and `GET /interview/questions/{id}`.

Related: [09-explore-sections](./09-explore-sections.md) (Explore → Interview Prep tile), learner contract: [06-interview-prep.md](./06-interview-prep.md) (restore from git if missing on disk), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §16.4. App types: `InterviewCategory` / `InterviewQuestion` in `src/core/types.ts`. Screens: `src/screens/interview/*`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Add a topic chip (HR, Technical, …) | Create category with stable id → Free·Paid → publish |
| Add a practice question | Create question → **prompt** + **model answer** + category → order / tips / level → publish |
| Change a live question later | Edit any field (prompt, answer, tips, category, order, access); Save keeps learner payload in sync |
| Offer a paid 1-on-1 mock | Seed / configure category `int-mock` as **Paid** with a real **product id** and honest fulfillment notes — not an AI interviewer or calendar booking |
| Gate a paid bank | Access: Free or Paid (same honesty rules as courses/news) |
| See what the app shows | Preview: topic chip + question card + answer-practice screen |

Explore section `interview-prep` only **navigates** to Interview Prep. Publishing that Explore tile does **not** create categories or questions.

---

## Content model (what the app understands)

```
InterviewCategory              ← topic chips + “1-on-1 mock” CTA target
  └─ InterviewQuestion[]       ← question bank cards + answer practice
        ├─ prompt              ← question text (required)
        ├─ modelAnswer?        ← revealable model answer
        ├─ tips[]?             ← coaching bullets (admin + future UI)
        ├─ tags / level / role ← discovery & filters (admin + search)
        └─ sortOrder           ← practice / list order
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Category** | Topic chips, paid lock, 1-on-1 CTA | `InterviewPrep` chips, “1-on-1 mock” quick action (`int-mock`), `InterviewQuestionList` |
| **Question** | Bank card + timed practice | Home preview (first 3), list, `InterviewQuestion` (prompt + model answer) |

Do **not** require embedding full question sets inside the category list payload. Questions live on `GET /interview/questions` (filterable by `categoryId`).

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/interview` | Question list (default landing) |
| `/admin/interview/new`, `/admin/interview/:id` | Create / edit / publish question |
| `/admin/interview/categories` | Category list |
| `/admin/interview/categories/new`, `/admin/interview/categories/:id` | Create / edit / publish category |
| `/admin/interview/cta` (optional) | Configure 1-on-1 product CTA copy + linked product |

Also allow **Add question** from Category edit → Questions tab (category pre-filled).  
Every category and every question must stay **fully editable** after publish (prompt, model answer, tips, tags, level, order, access, product). Editing never changes published `id`s.

---

## 1. Categories

### Preferred stable ids (chip short labels)

The learner hub hard-codes short chip labels for these ids. Seed them when possible; **do not rename ids after publish**.

| Stable id | Suggested title | Chip short label | Suggested `iconKey` | Notes |
|---|---|---|---|---|
| `int-hr` | HR questions | HR | `users` | Free behavioural / intro bank |
| `int-tech` | Technical questions | Technical | `code` | Role / stack questions |
| `int-gd` | Group discussion | Group discussion | `mic` | GD prompts |
| `int-apt` | Aptitude & reasoning | Aptitude | `brain` | Short reasoning prompts |
| `int-mock` | 1-on-1 mock interview | Mock interview | `video` | **Paid product CTA** target (see §3) |
| `int-resume` | Resume & profile | Resume | `file` | CV / LinkedIn prompts |

Extra category ids are allowed; unknown ids use the full `title` as the chip label (no short-label map).

### List columns

| Column | Shows |
|---|---|
| Title | Category title |
| Id | Stable id (read-only after create) |
| Questions | Count of **published** questions |
| Access | **Free** or **Paid** |
| Product | Linked product id (for paid / mock) or — |
| Order | `sortOrder` |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, unpublish, archive |

Filters: All · Free · Paid · Published · Draft. Search title / summary / keywords.

### Create / edit form

```
Category
  Id *                 [ int-hr                           ]  ← editable only while draft / first save
  Title *              [ HR questions                     ]
  Summary              [ Introductions and behaviour…     ]  ← optional subtitle
  Icon key             [ users                            ]
  Theme / clay         [ mint                             ]
  Cover image URL      [ https://cdn…/hr.jpg              ]  ← optional HTTPS
  Keywords             [ hr, behavioural, introduction    ]
  Sort order           [ 10                               ]
  Access               ( • Free )  ( ○ Paid )
  Product id (if Paid) [ product-interview-mock-01        ]  ← required when Paid / mock CTA
  Fulfillment notes    [ Manual 1:1 session; staff books… ]  ← admin honesty; not shown as AI/calendar
  Lifecycle            Draft | Published | Archived
```

### Field → app mapping

| Admin field | Learner field | App use |
|---|---|---|
| Id | `id` | Chip filter, question `categoryId`, list route, `targetKind: interviewCategory` |
| Title | `title` / `name` | Chip label when id is not in the short-label table; list header |
| Summary | `summary` / `subtitle` / `description` | Optional subtitle |
| Icon key | `iconKey` | Bundled icon |
| Access Free/Paid | `pricing` / `commercialMode` + `access` | Free topic count; paid lock |
| Paid lock | `access.granted: false`, `reason: "purchase_required"` | Blocks opening `InterviewQuestionList` (shows unavailable / purchase path) |

### Rules

1. **Stable `id`** after first save (prefer `int-…` seeds above). Never rename after publish — chips, deep links, Explore `interview-category:{id}`, bookmarks, and question `categoryId` use it.
2. Publish requires title + id. Soft-warn if zero published questions (empty bank).
3. Archiving a category must **block** if published questions still point at it (or force reassign first).
4. **Free** → guests and signed-in users get `access.granted`. **Paid** → hub may show the chip; opening the list is blocked when `access.reason === "purchase_required"` until entitlement.
5. Prefer keeping `int-hr` and `int-tech` **Free** so the home warmup / surprise actions always have practice content for guests.
6. **`int-mock`** should be Paid with a real product (see §3). Do not claim AI interviewer or instant calendar booking unless those systems exist.
7. **Edit anytime** after publish; Save updates `GET /interview/categories` without changing `id`.

### Learner payload (category — `GET /interview/categories`)

```json
{
  "id": "int-hr",
  "title": "HR questions",
  "summary": "Introductions and behaviour",
  "pricing": "free",
  "commercialMode": "free",
  "iconKey": "users",
  "themeKey": "mint",
  "imageUrl": null,
  "sortOrder": 10,
  "lifecycle": "published",
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

Query: `search`, `pricing` (`free` \| `paid`), `cursor`. Only `lifecycle: "published"` rows. Sort by `sortOrder` ascending.

If `/interview/categories` is missing, the app builds one chip per distinct `categoryId` on the question list and shows the **raw id** as the label — publish real categories so learners see names.

Paid mock example:

```json
{
  "id": "int-mock",
  "title": "1-on-1 mock interview",
  "summary": "Guided feedback session",
  "pricing": "paid",
  "commercialMode": "paid",
  "iconKey": "video",
  "productId": "product-interview-mock-01",
  "access": {
    "granted": false,
    "canPreview": false,
    "canDownload": false,
    "reason": "purchase_required",
    "source": null
  }
}
```

---

## 2. Questions (fully editable)

Every question must be editable after publish: prompt, model answer, tips, category, order, tags, level, role/industry, locale, and access. Editing never changes `id`.

### List columns

| Column | Shows |
|---|---|
| Prompt | Truncated question text |
| Category | Category title |
| Level | Beginner / Intermediate / Advanced (or —) |
| Order | `sortOrder` |
| Access | Free / Paid |
| Status | Draft / Published / Scheduled / Archived |
| Actions | Edit, duplicate, publish, unpublish, archive |

Filters: category, level, Free/Paid, status. Search prompt, model answer, tips, tags, role.

### Create / edit form

```
Question
  Id *                    [ q-tell-me                         ]  ← editable only while draft / first save
  Category *              [ HR questions                    ▼ ]  ← must be a published category
  Prompt *                [ Tell me about yourself.           ]  ← learner-facing question
  Model answer            [ Present role, one proof point…    ]  ← revealable answer (recommended)
  Tips                    [ Keep it under 90 seconds ]
                          [ Lead with role + one proof ]
                          [ [ + Add tip ] ]

Discovery
  Tags                    [ introduction, behavioural         ]
  Role / industry         [ General / Campus / Banking…       ]
  Level                   ( ○ Beginner ) ( • Intermediate ) ( ○ Advanced )
  Locale                  [ en                                ]
  Keywords                [ tell me about yourself            ]

Order & access
  Sort order              [ 10                                ]  ← bank / warmup order
  Access                  ( • Free )  ( ○ Paid )
  Product id (if Paid)    [ optional product for checkout     ]

Schedule / lifecycle
  Lifecycle               Draft | Published | Scheduled | Archived
  Starts at / Ends at     [ optional window ]
```

Inline edit of prompt / model answer / tips / order must work for **published** questions without forcing unpublish.

### Field → app mapping

| Admin field | Learner field | App use |
|---|---|---|
| Id | `id` | `InterviewQuestion` route, bookmarks, `targetKind: interviewQuestion` |
| Category | `categoryId` | Chip filter; must match a category `id` exactly |
| **Prompt** | `prompt` (fallback `question` / `title`) | Bank card + practice screen; `prompt` wins |
| **Model answer** | `modelAnswer` (fallback `answer`) | Revealed answer; empty → generic practice hint in app |
| Tips | `tips[]` (optional) | Store now for admin + future UI; safe to omit on learner if unused |
| Level / tags / role | (index + admin; optional on learner) | Search, filters, future chips |
| Sort order | `sortOrder` | List / warmup order when returned by API |
| Access Free/Paid | `access` + `commercialMode` | Gate detail when paid |

Current mobile mapper only **requires** `id`, `categoryId`, `prompt`, and optional `modelAnswer`. Extra fields are welcome for admin, search, and future clients — they must not break the learner payload.

### Rules

1. **Stable `id`** on first save (e.g. `q-tell-me` or slug-based). Never rename after publish — deep links, bookmarks, notifications, and Explore `interviewQuestion:{id}` / `interview-question:{id}` use it.
2. **`categoryId` must exist** in published categories. Block publish otherwise.
3. **`prompt` required** for publish (trim). Prefer ~8–160 characters; warn above ~220.
4. **`modelAnswer` recommended**. Empty is allowed; do not send `" "`. The practice screen shows a generic hint when missing.
5. Prefer returning `modelAnswer` on **both** list and detail (same mapper). The list UI does not print it, but detail and list share one shape.
6. **Order** = practice bank order. Reorder in admin; learner list should respect `sortOrder` ascending (then stable id).
7. **Free** → guests get the question. **Paid** → do not leak `modelAnswer` until `access.granted` (return prompt metadata + empty/omitted answer, or block detail — pick one policy and keep it honest).
8. **Edit anytime** in Draft. After Publish, all content fields stay editable; Save updates `GET /interview/questions` and `GET /interview/questions/{id}` immediately (or after schedule). Confirm copy: “Learners will see these changes on next refresh.”
9. Changing prompt / answer / tips must **not** change `id`, bookmarks, or banner `targetKind: interviewQuestion`.
10. Changing category is allowed (reassign); validate the new category is published. Warmup / surprise still work as long as some Free questions remain published.
11. **Unpublish / archive** removes the question from learner list and detail (404 or empty). Prefer archive over hard-delete.
12. Home preview shows the **first three** filtered questions; “Surprise me” picks a random published question; “Start 5-min practice” opens the first visible question — keep at least a few Free questions published.

### Learner payload (list — `GET /interview/questions`)

Query: `categoryId` optional. **Omit** `categoryId` on the Interview Prep home so every published question is available for search, warmup, and surprise.

Bare array **or** `{ "items": [...] }` is accepted.

```json
[
  {
    "id": "q-tell-me",
    "categoryId": "int-hr",
    "prompt": "Tell me about yourself.",
    "modelAnswer": "Present role, one proof point, and why this job.",
    "tips": [
      "Keep it under 90 seconds",
      "Lead with role + one proof"
    ],
    "level": "intermediate",
    "tags": ["introduction", "behavioural"],
    "sortOrder": 10,
    "access": {
      "granted": true,
      "canPreview": true,
      "canDownload": false,
      "reason": null,
      "source": "free"
    }
  }
]
```

### Learner payload (detail — `GET /interview/questions/{id}`)

Same object shape as one list item. This is what the answer-practice screen renders (`prompt` + optional `modelAnswer`).

When access is denied, still return `id`, `categoryId`, and `prompt` if product policy allows teaser; omit or empty `modelAnswer` / `tips` so answers do not leak.

---

## 3. 1-on-1 mock product CTA

The Interview Prep home has a **“1-on-1 mock”** quick action that opens category `int-mock` when present.

| Rule | Detail |
|---|---|
| Seed | Publish category id **`int-mock`** |
| Commerce | Link a **real** published product (`productId`) with honest price and fulfillment |
| Access | Until purchased: `access.granted: false`, `reason: "purchase_required"` |
| Honesty | Do **not** label it as an AI interviewer, live calendar booking, or instant coach unless those systems exist |
| Fulfillment | Store internal notes (who delivers the mock, SLA, booking channel) in admin only |
| Fallback | If `int-mock` is missing / unpublished, the PRO quick action stays disabled — do not invent a fake category in the learner API |

Optional admin CTA screen can edit display title / summary shown on the category without changing the stable id.

---

## 4. Preview (required)

On the question editor, show side-by-side (or tabbed) previews using **current draft** values:

1. **Topic chip** — short label for known ids, else full title; Free/Paid badge.
2. **Bank card** — prompt + category title (as on Interview Prep / list).
3. **Practice prompt** — indigo quote card with prompt text.
4. **Model answer reveal** — answer body or the generic practice hint when empty.

On the category editor, preview chip + locked vs unlocked list entry for Paid.

Preview must reflect unsaved form state.

---

## 5. Publish rules for learner API

- Only `lifecycle: "published"` categories appear on `GET /interview/categories`.
- Only published questions appear on `GET /interview/questions` / `{id}`.
- Drop questions missing `id`, `categoryId`, or `prompt`.
- Every question `categoryId` must exist in published categories.
- Detail returns 404 for unpublished / archived / unknown ids.
- Changing title / prompt never changes category or question `id`.
- Keep ids stable across edits; the app routes by id, not by title.
- Global search index should include category title/summary and question prompt (+ model answer when access allows); remove archived content promptly.

---

## 6. Admin API shape (create / patch)

### Category

```json
{
  "title": "HR questions",
  "summary": "Introductions and behaviour",
  "iconKey": "users",
  "themeKey": "mint",
  "imageUrl": null,
  "keywords": ["hr", "behavioural"],
  "sortOrder": 10,
  "commercialMode": "free",
  "productId": null,
  "fulfillmentNotes": null,
  "lifecycle": "published"
}
```

### Question

```json
{
  "categoryId": "int-hr",
  "prompt": "Tell me about yourself.",
  "modelAnswer": "Present role, one proof point, and why this job.",
  "tips": [
    "Keep it under 90 seconds",
    "Lead with role + one proof"
  ],
  "tags": ["introduction", "behavioural"],
  "role": "General",
  "level": "intermediate",
  "locale": "en",
  "keywords": ["tell me about yourself"],
  "sortOrder": 10,
  "commercialMode": "free",
  "lifecycle": "published"
}
```

Suggested routes (names illustrative):

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/admin/interview/categories` | List / create |
| `GET/PATCH` | `/admin/interview/categories/:id` | Read / update |
| `POST` | `/admin/interview/categories/:id/publish` | Publish |
| `POST` | `/admin/interview/categories/:id/unpublish` | Unpublish |
| `POST` | `/admin/interview/categories/:id/archive` | Archive |
| `GET/POST` | `/admin/interview/questions` | List / create |
| `GET/PATCH` | `/admin/interview/questions/:id` | Read / update (full edit) |
| `POST` | `/admin/interview/questions/:id/publish` | Publish |
| `POST` | `/admin/interview/questions/:id/unpublish` | Unpublish |
| `POST` | `/admin/interview/questions/:id/archive` | Archive |
| `PUT` | `/admin/interview/questions/reorder` | Optional bulk reorder within a category |
| `POST` | `/admin/media` | Optional cover upload → CDN URL |

Audit every create, edit (especially prompt / model-answer changes), reorder, publish, unpublish, access change, product link, and archive.

---

## 7. Permissions

| Action | Permission (illustrative) |
|---|---|
| Create / edit draft categories & questions | `interview.author` |
| Upload media | `media.upload` |
| Link / change paid product on mock CTA | `interview.commerce` or `catalog.pricing` |
| Publish / unpublish | `interview.publish` |
| Archive | `interview.publish` |

---

## Acceptance checklist

- [ ] Admin can seed preferred `int-*` category ids (including `int-mock`) and publish them to `GET /interview/categories`.
- [ ] Staff can create a question with category, prompt, model answer, optional tips/level/tags, Free/Paid, and sort order.
- [ ] Published questions appear on Interview Prep; chip filter uses exact `categoryId`.
- [ ] Detail on `GET /interview/questions/{id}` returns `prompt` and `modelAnswer`.
- [ ] Editing prompt / answer / tips after publish updates learner APIs **without** changing question or category `id`s.
- [ ] Reordering questions changes bank / warmup order in the app.
- [ ] Paid categories with `reason: "purchase_required"` do not open the question list until entitled.
- [ ] `int-mock` links a real product; copy never claims AI interviewer or calendar booking unless those systems exist.
- [ ] Questions with missing `categoryId` or empty prompt cannot publish.
- [ ] Unpublished / archived rows disappear from learner list and detail.
- [ ] Home “Surprise me” / warmup still work when Free questions are published.
- [ ] Every create, edit, reorder, publish, and archive is audited.

---

## Out of scope (phase 1)

- Live AI interviewer or speech scoring.
- Calendar / Zoom booking UI inside the learner app.
- Per-question audio / video model answers.
- Server-side timed exam grading for interview prompts (client timer is local practice only).
- Auto-translate of prompts/answers (do not claim EN copy is HI).
- Push notification composer (use notifications module; target `interviewQuestion` / `interviewCategory` + id).
- Changing the hardcoded chip short-label map in the mobile app (new ids simply show full `title` until a mobile update).

---

## Smoke path

```
1. Admin → Interview Prep → Categories → New
2. Id int-hr, Free, title “HR questions” → Publish
3. Add int-tech (Free) and int-mock (Paid + product) → Publish
4. Questions → New: category int-hr, prompt “Tell me about yourself.”,
   model answer + two tips → Publish (add 2–3 more Free questions)
5. Learner: Explore → Interview Prep
   Chips HR / Technical, warmup, Surprise me, open question → reveal answer
6. Tap 1-on-1 mock → paid lock / purchase path for int-mock
7. Edit a model answer in admin → Save → pull-to-refresh in app → new answer
```
