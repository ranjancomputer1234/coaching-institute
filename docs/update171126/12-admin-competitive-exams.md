# Handover 12 — Admin: competitive exams, tests & questions

Admin-web spec so staff can **create and edit** competitive exams, attach **mock / practice tests**, author **single-choice questions** (with **marks** and **negative marks**), set **how many questions** each test uses, publish to the learner API, and keep everything editable without breaking the app.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage content in admin; learners read published rows from `GET /exams`, `GET /exams/{id}`, `GET /tests?examId=`, `GET /tests/{id}`.

Related: [09-explore-sections](./09-explore-sections.md) (Explore → Competitive Exam tile), [10-admin-courses-pricing](./10-admin-courses-pricing.md) (Free / Paid pattern), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §14. App types: `Exam`, `TestDefinition`, `Question` in `src/core/types.ts`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Add a competitive exam (SSC, Banking, …) | Create exam → fill title / summary / Free·Paid → publish |
| Add a mock or practice test under that exam | Create test linked to the exam → set duration, marking, question count |
| Add / edit questions | Question bank: prompt, options, **marks**, **negative marks** → approve |
| Choose which questions sit in a test | Test builder: pick approved questions; count + total marks update live |
| Change marks or question text later | Edit question or replace the test’s question set (rules below) |
| See what the app shows | Preview matches Instructions: title, N questions, minutes, marking, FREE/PAID |

Do **not** invent a parallel “syllabus CMS” for phase 1. Exam detail syllabus copy in the app can stay curated; admin’s job is **exam catalogue + tests + question bank**.

---

## Content model (what the app understands)

```
Exam                          ← Competitive Exams list + Exam Detail
  └─ Test (mock / practice)   ← Test list + Instructions screen
        └─ Questions[]        ← Loaded only when an attempt starts (not on GET /tests/:id)
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Exam** | Catalogue card (SSC CGL, Banking, …) | `CompetitiveExams`, `ExamDetail` |
| **Test** | One sittable paper under an exam | Test list on exam, `TestInstructions` |
| **Question** | Single-choice item with marks | Attempt / runner / result review |

Explore section `competitive-exam` only **navigates** to the exam catalogue. Publishing an Explore tile does **not** create exams or tests.

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/exams` | List exams |
| `/admin/exams/new`, `/admin/exams/:id` | Create / edit / publish exam |
| `/admin/questions` | Question bank |
| `/admin/questions/new`, `/admin/questions/:id` | Create / edit / approve / retire |
| `/admin/tests` | List tests |
| `/admin/tests/new`, `/admin/tests/:id` | Create / edit test, attach questions, publish |

Also allow **Add test** from Exam edit → Tests tab (exam pre-filled).  
Also allow **Add question to bank** and **Attach from bank** from Test edit → Questions tab.

---

## 1. Exams

### List columns

| Column | Shows |
|---|---|
| Title | Exam title |
| Access | **Free** or **Paid** (and ₹ amount when price exists — same idea as courses) |
| Tests | Count of **published** tests (`testCount` on learner API) |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, unpublish, archive |

Filters: All · Free · Paid · Published · Draft. Search by title. Sort by `sortOrder` or title.

### Create / edit form

```
Exam
  Title *              [ SSC CGL                         ]
  Summary              [ CGL, CHSL-style prep…           ]   ← subtitle in the app
  Description          [ Longer blurb for Exam Detail…   ]
  Cover image URL      [ https://…                       ]
  Icon key             [ trophy                          ]
  Theme / clay         [ orange                          ]
  Access               ( • Free )  ( ○ Paid )
  Related exam ids     [ exam-ssc, exam-chsl             ]   ← optional string ids
  Display learner count[ 12000                           ]   ← optional vanity metric
  Sort order           [ 10                              ]
```

Rules:

1. **Stable `id`** after first save (e.g. `exam-ssc`). Never rename the id after publish — deep links and bookmarks use it.
2. **Free** → learner `pricing: "free"`, `access.granted` for guests on free content.
3. **Paid** → `commercialMode: "paid"`; without entitlement the app shows a paid badge and blocks start (purchase flow may still be unavailable — do not fake access).
4. `testCount` on the learner API = count of **published** tests for this exam (server-derived, not typed by staff).
5. Publish requires title. Empty exams may publish (catalogue card with “0 tests”); prefer warning: “No published tests yet.”

### Learner payload (exam)

```json
{
  "id": "exam-ssc",
  "title": "SSC CGL",
  "summary": "CGL, CHSL, MTS and GD",
  "description": "Complete SSC preparation with timed mocks.",
  "pricing": "free",
  "commercialMode": "free",
  "iconKey": "trophy",
  "themeKey": "orange",
  "imageUrl": null,
  "testCount": 2,
  "learnerCount": 12000,
  "relatedExams": ["exam-chsl"],
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

App mapping: `summary` → subtitle; `testCount` on Exam Detail; Free/Paid from `pricing` / `commercialMode`.

---

## 2. Question bank (fully editable)

Phase 1: **`single_choice` only**. The learner app answers by **option id**, not by A/B/C position.

### List columns

| Column | Shows |
|---|---|
| Prompt | Truncated stem |
| Marks | e.g. `+2` |
| Neg. marks | e.g. `-0.5` or `0` |
| Subject / topic | Tags |
| Status | Draft / Approved / Retired |
| Used in | Count of tests referencing it |
| Actions | Edit, approve, retire, duplicate |

Filters: status, subject, exam tag, marks. Search prompt text.

### Create / edit form

```
Question
  Type *            single_choice          ← fixed for phase 1
  Prompt *          [ Which of the following…? ]
  Helper / hint     [ optional               ]
  Explanation       [ shown after solutions release ]
  Subject           [ Quantitative Aptitude  ]
  Topic             [ Percentage             ]
  Difficulty        [ easy | medium | hard   ]

Marks *
  Marks (correct) *     [ 2 ]        ← required, number > 0
  Negative marks        [ 0.5 ]      ← 0 allowed; used when test enables negative marking

Options *  (min 2, exactly one Correct)
  ○  A   [ 25%     ]   Correct: ( )
  ○  B   [ 20%     ]   Correct: ( • )
  ○  C   [ 15%     ]   Correct: ( )
  ○  D   [ 10%     ]   Correct: ( )
  [ + Add option ]
```

Rules:

1. Each option gets a **stable option id** on create. Correctness is stored on the option (`isCorrect`), never as “option index 2”.
2. Exactly **one** correct option for `single_choice`. Block save otherwise.
3. **Marks** and **negative marks** are per-question numbers. The test’s display labels (`marking: "+2"`, `negativeMarking: "-0.5"`) should match the questions staff attach — see Test builder.
4. **Edit anytime** while `draft`. After **approve**, allow edit of prompt / options / marks with confirm: “This updates the bank. Published tests keep their previous snapshot until you re-attach or republish.”
5. Once a question appears in a **started learner attempt**, that attempt keeps an immutable snapshot. Editing the bank must **not** rewrite past attempts.
6. **Retire** = cannot attach to new tests; existing published tests that already include it stay valid until staff remove it.
7. Approve permission: `assessments.publish` (or equivalent). Author permission: `assessments.author`.

### Admin API shape (create / patch)

```json
{
  "prompt": "Which of the following is 20% of 100?",
  "type": "single_choice",
  "explanation": "20% of 100 = 20.",
  "subject": "Quantitative Aptitude",
  "topic": "Percentage",
  "difficulty": "easy",
  "marks": 2,
  "negativeMarks": 0.5,
  "options": [
    { "label": "25", "isCorrect": false, "sortOrder": 0 },
    { "label": "20", "isCorrect": true, "sortOrder": 1 },
    { "label": "15", "isCorrect": false, "sortOrder": 2 },
    { "label": "10", "isCorrect": false, "sortOrder": 3 }
  ]
}
```

---

## 3. Tests (mocks & practice) — question count + marks

A **test** is what the learner opens on Instructions (`SSC CGL Mock 1`, `25 questions · 30 minutes`, marking `+2` / `-0.5`).

### List columns

| Column | Shows |
|---|---|
| Title | Test title |
| Exam | Parent exam title |
| Mode | Practice / Formal |
| Questions | `questionCount` (attached) |
| Max score | Sum of question marks |
| Duration | Minutes |
| Access | Free / Paid |
| Status | Draft / Published / Archived |
| Actions | Edit, attach questions, publish |

### Create / edit form — settings

```
Test
  Title *                 [ SSC CGL Mock 1              ]
  Exam *                  [ SSC CGL                    ▼ ]
  Mode *                  ( • Formal )  ( ○ Practice )
  Access                  ( • Free )  ( ○ Paid )
  Duration (minutes) *    [ 30 ]
  Pass threshold (%)      [ 40 ]
  Attempt limit           [ blank = unlimited ]
  Instructions            [ optional long text ]

Marking (shown on Instructions)
  Marking label *         [ +2 ]       ← what the app prints as “Marking: +2”
  Negative marking label  [ -0.5 ]     ← “Negative marking: -0.5” (or “0” / “Not published”)
  Apply negative marking  [ ✓ ]        ← server scoring flag; when off, wrong = 0

Result / solutions
  Solution policy         [ after_result_publish | immediate | hidden ]
  Resume policy           [ allow | deny ]
```

**Mode**

| Mode | App behaviour |
|---|---|
| `formal` | `TestRunner` — no live reveal of correct/incorrect |
| `practice` | `DailyQuiz` / practice runner — may reveal after answer |

### Questions tab — set count and marks

```
Questions
  Target question count *   [ 25 ]     ← staff-set target
  Attached now              25 / 25
  Max score (auto)          50         ← sum of marks on attached questions

  [ Pick from bank… ]   [ Create question… ]   [ Reorder ]

  #  Prompt                         Marks   Neg    Status
  1  Which of the following…?         2     0.5    approved
  2  …                                2     0.5    approved
  … 
  25 …
```

Rules:

1. **Target question count** is required before publish. Staff set the number (e.g. 25).  
2. **Attached count must equal target** to publish. Show live `attached / target`.  
3. Only **approved** questions can be attached.  
4. **Max score** = Σ `marks` of attached questions (read-only in UI; store on test as `maxScore`).  
5. Prefer all attached questions sharing the same marks / negative marks so Instructions labels (`+2`, `-0.5`) stay honest. If mixed marks, either:
   - set marking label to something accurate (e.g. `varies`), or  
   - block publish with “Mixed marks — set a clear marking label or use uniform marks.”  
6. Replacing the question set: `POST …/tests/:id/questions` with the full `questionIds[]` (replace semantics). Allow add / remove / reorder in the UI.  
7. **Edit after publish:**  
   - Metadata (title, duration, labels) → patch + optional republish.  
   - Question set change → create a **new test revision** (or unpublish → edit → publish) so in-flight attempts keep their snapshot. Do not silently rewrite questions under an active published revision that already has attempts.  
8. Publish validation (`TEST_INVALID` if any fail):

| Check | Fail when |
|---|---|
| Questions present | Zero attached |
| Count match | `attached ≠ target questionCount` |
| Approved | Any question not approved |
| Correct option | Any question lacks exactly one correct option |
| Marks | Any question missing `marks > 0` |
| Max score | Stored max ≠ sum of marks |
| Unsupported type | Type ≠ `single_choice` |

### Learner payload (test) — Instructions screen

`GET /tests/{id}` must **not** include question bodies or correct answers.

```json
{
  "id": "test-ssc-mock-1",
  "examId": "exam-ssc",
  "title": "SSC CGL Mock 1",
  "questionCount": 25,
  "durationMinutes": 30,
  "pricing": "free",
  "mode": "formal",
  "marking": "+2",
  "negativeMarking": "-0.5",
  "passThreshold": 40,
  "attemptLimit": null,
  "resumePolicy": "allow",
  "solutionPolicy": "after_result_publish",
  "maxScore": 50,
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

App mapping today:

| API field | Instructions UI |
|---|---|
| `title` | Title |
| `questionCount` | “25 questions” |
| `durationMinutes` → seconds | “30 minutes” |
| `pricing` | FREE / PAID badge |
| `marking` | “Marking: +2” |
| `negativeMarking` | “Negative marking: -0.5” |
| `attemptLimit` | Shown when set |
| `solutionPolicy` | “Solutions: …” when set |
| `mode` | formal → TestRunner; practice → DailyQuiz |

`GET /tests?examId=exam-ssc` returns a **bare array** of published tests (not a page object).

---

## 4. Recommended staff workflow

```text
1. Create Exam (draft) → Publish exam
2. Create Questions in bank → set marks + negative marks → Approve
3. Create Test under exam → set duration, marking labels, target question count
4. Attach exactly N approved questions → confirm max score
5. Publish test
6. Smoke in app: Competitive Exams → Exam → Test → Instructions
   (title, N questions, minutes, marking, FREE/PAID)
```

Daily / practice shortcut: create a `mode: "practice"` test (e.g. “Daily current affairs”) under the same or a dedicated exam; same question rules.

---

## 5. Editing checklist (including questions)

| Change | Safe approach |
|---|---|
| Fix typo in draft question | Edit → save |
| Fix typo in approved question not yet in a published test | Edit → re-approve if your policy requires it |
| Fix question already on a published test with **no** attempts | Unpublish test → edit / replace questions → publish |
| Fix question with **existing** attempts | Leave old snapshot; retire bad question; attach a new question on a new test revision |
| Change marks on a question | Updates bank + future attachments; past attempts keep snapshot marks |
| Change target count 25 → 30 | Attach 5 more approved questions; publish only when `30/30` |
| Change exam title | Allowed; keep stable `id` |
| Delete exam / test | Prefer **archive**; never hard-delete rows referenced by attempts |

---

## 6. Permissions (suggested)

| Action | Permission |
|---|---|
| Create / edit exam | `content.create` / `content.edit` |
| Publish exam | `content.publish` |
| Create / edit / retire question | `assessments.author` |
| Approve question | `assessments.publish` |
| Create / edit test + attach questions | `assessments.author` |
| Publish test | `assessments.publish` |
| View attempts / publish results | `results.read` / `results.publish` |

---

## 7. Learner attempt & results (API must ship)

Listing exams/tests is not enough for **Begin test**. The app calls:

| Method | Path | Role |
|---|---|---|
| `POST` | `/tests/{id}/attempts` | Start (auth); return attempt id, `expiresAt`, `revision`, **question snapshot** (options **without** correct answers for formal) |
| `GET` | `/attempts/{id}` | Resume |
| `PUT` | `/attempts/{id}/answers/{questionId}` | `{ optionId, revision }` |
| `POST` | `/attempts/{id}/submit` | `{ revision }` → score from snapshot |
| `GET` | `/attempts/{id}/result` | Result when policy allows |
| `GET` | `/me/attempts` | History |

**Current production gap:** these learner routes are missing (404). Admin can still author exams/tests/questions; the Instructions screen will show that starting is unavailable until the API is deployed. Do **not** point the mobile app at `/admin/attempts`.

When implementing start-attempt, snapshot each question’s prompt, options (ids + labels), marks, negative marks, and correct option id **server-side only**. Scoring uses that snapshot.

---

## 8. Seed example (matches today’s app catalogue)

| Entity | Example |
|---|---|
| Exam | `exam-ssc` — “SSC CGL”, free |
| Formal test | `test-ssc-mock-1` — “SSC CGL Mock 1”, 25 questions, 30 min, marking `+2`, negative `-0.5`, free, formal |
| Practice test | `test-daily` — “Daily current affairs”, 10 questions, 15 min, marking `+1`, negative `0`, practice |

Each of the 25 mock questions: `marks: 2`, `negativeMarks: 0.5`, four options, one correct, **approved**, attached to the test, then **publish**.

---

## 9. Admin QA before calling it done

- [ ] Create exam → appears on `GET /exams` only after publish  
- [ ] Create question with marks + negative marks → edit prompt/options → approve  
- [ ] Create test with target count 25 → cannot publish at 24/25  
- [ ] Attach 25 approved questions → max score = sum of marks  
- [ ] Publish test → `GET /tests?examId=` includes it; `GET /tests/{id}` shows count, duration, marking labels, **no** answers  
- [ ] Edit a bank question used by a draft test → test preview updates  
- [ ] Retire a question → cannot attach to new tests  
- [ ] Paid exam/test without entitlement → app shows paid / denied access, not a false start  
- [ ] (When attempt API exists) Begin test → N questions → submit → score uses per-question marks / negative marks  

---

## Out of scope for this handover

- Multi-correct / numeric / essay question types in the learner app  
- Full syllabus CMS for Exam Detail tabs  
- Live proctoring  
- Using `/admin/attempts` as the student path  

Those can follow once single-choice mocks work end-to-end on learner routes.
