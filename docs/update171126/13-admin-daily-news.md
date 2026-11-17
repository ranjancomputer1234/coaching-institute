# Handover 13 — Admin: Daily News (articles, key highlights & image)

Admin-web spec so staff can **create, edit, and publish** Daily News categories and articles with a **hero image**, **key highlights**, excerpt, and body — matching what the learner app already renders on `DailyNews`, `NewsFeed`, and `NewsArticle`.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage content in admin; learners read published rows from `GET /news/categories`, `GET /news`, and `GET /news/{id}`.

Related: [09-explore-sections](./09-explore-sections.md) (Explore → News tile), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §16.1. App type: `NewsArticle` in `src/core/types.ts`. Screens: `src/screens/news/*`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Add a news category chip | Create category with stable id → publish |
| Add a news story | Create article → title, excerpt, body, **key highlights**, **image** → publish |
| Change a live story later | Edit any field (including highlights & image); republish / save keeps learner payload in sync |
| Feature a story on the feed | Toggle **Featured** (one primary featured per list is enough for the app) |
| Gate full body / highlights | Access: Free or Paid (same honesty rules as courses/exams) |
| See what the app shows | Preview: feed card + article hero + Key Highlights card |

Explore section `news` only **navigates** to Daily News. Publishing that Explore tile does **not** create categories or articles.

---

## Content model (what the app understands)

```
NewsCategory                 ← chips on DailyNews / NewsFeed
  └─ NewsArticle[]           ← feed cards + article detail
        ├─ imageUrl          ← hero / card artwork (HTTPS)
        ├─ excerpt           ← lead paragraph on article
        ├─ body[]            ← paragraphs (access-gated)
        └─ highlights[]      ← “Key Highlights” checklist (access-gated)
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Category** | Filter chips | `DailyNews`, `NewsFeed` |
| **Article** | Story card + full read | Feed list, featured card, `NewsArticle` |

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/news` | Article list (default landing) |
| `/admin/news/new`, `/admin/news/:id` | Create / edit / publish article |
| `/admin/news/categories` | Category list |
| `/admin/news/categories/new`, `/admin/news/categories/:id` | Create / edit / publish category |

Also allow **Add article** from Category edit → Articles tab (category pre-filled).

---

## 1. Categories

Stable ids the app already special-cases for chip labels/icons (seed these; do not rename ids after publish):

| Stable id | Label | Suggested `iconKey` |
|---|---|---|
| `news-national` | National | `india` |
| `news-international` | International | `globe` |
| `news-state` | State | `map` |
| `news-sports` | Sports | `trophy` |
| `news-banking` | Banking | `bank` |
| `news-business` | Business & Finance | `chart` |
| `news-science` | Science & Tech | `atom` |

Extra categories are allowed; unknown ids still render as “Daily News” with a generic `news` icon.

### List columns

| Column | Shows |
|---|---|
| Title | Category title |
| Id | Stable id (read-only after create) |
| Articles | Count of **published** articles |
| Order | `sortOrder` |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, unpublish, archive |

### Create / edit form

```
Category
  Id *                 [ news-national     ]   ← editable only while draft / first save
  Title *              [ National          ]
  Icon key             [ india             ]
  Theme / clay         [ cyan              ]
  Sort order           [ 10                ]
  Lifecycle            Draft | Published | Archived
```

Rules:

1. **Stable `id`** after first publish. Deep links, filters, and article `categoryId` use it.
2. Publish requires title + id. Prefer warning if zero published articles.
3. Archiving a category must **block** if published articles still point at it (or force reassign first).

### Learner payload (category)

```json
{
  "id": "news-national",
  "title": "National",
  "iconKey": "india",
  "themeKey": "cyan",
  "sortOrder": 10,
  "lifecycle": "published"
}
```

Returned on `GET /news/categories` — already sorted by `sortOrder`. Only `published` rows.

---

## 2. Articles (fully editable)

Every article must be editable after publish: title, image, highlights, body, featured flag, category, and access. Editing never changes `id`.

### List columns

| Column | Shows |
|---|---|
| Title | Article title |
| Category | Category title |
| Image | Thumb or “No image” |
| Highlights | Count (e.g. `3`) |
| Featured | Yes / — |
| Access | Free / Paid |
| Published | `publishedAt` |
| Status | Draft / Published / Scheduled / Archived |
| Actions | Edit, duplicate, publish, unpublish, archive |

Filters: category, featured, Free/Paid, status. Search title, byline, tags, excerpt.

### Create / edit form

```
Article
  Title *                 [ RBI keeps repo rate unchanged…        ]
  Category *              [ National                            ▼ ]  ← must be a published category
  Byline                  [ RACI News Desk                        ]
  Published / source at * [ 2026-11-17 09:30 IST                  ]
  Reading minutes         [ 3 ]   ← optional override; else auto ≈ body length
  Featured                [ ✓ ]   ← feed “featured” story
  Tags                    [ economy, rbi, rates                   ]  ← chips / hashtags

Image (hero + feed card)
  Image URL *             [ https://cdn…/news-1.jpg               ]  ← HTTPS only
  Alt text                [ RBI building exterior                 ]
  [ Upload… ]             ← stores to CDN; writes Image URL
  [ Clear image ]

Summary
  Excerpt *               [ Short lead shown under the title…     ]

Body *  (paragraph list — one block per paragraph)
  1. [ First paragraph… ]
  2. [ Second paragraph… ]
  [ + Add paragraph ]   [ Reorder ]

Key Highlights *  (2–6 short bullets — app “Key Highlights” card)
  1. [ Repo rate held at 6.5% ]
  2. [ Inflation within band ]
  3. [ Next review in December ]
  [ + Add highlight ]   [ Reorder ]

Access
  ( • Free )  ( ○ Paid )
  Product id (if Paid)    [ optional product for checkout ]

Schedule / lifecycle
  Lifecycle               Draft | Published | Scheduled | Archived
  Starts at / Ends at     [ optional window ]
```

### Field → app mapping

| Admin field | Learner field | App use |
|---|---|---|
| Title | `title` | Feed card + article headline |
| Category | `categoryId` | Chip filter + category label/icon |
| Byline | `byline` | Author row (fallback “RACI News Desk”) |
| Published at | `publishedAt` | Relative / calendar date |
| Reading minutes | `readingMinutes` | “N MIN READ” (fallback 3) |
| Excerpt | `excerpt` | Lead block + share text + feed preview |
| Body paragraphs | `body: string[]` | Article body (only when `access.granted`) |
| **Key Highlights** | `highlights: string[]` | Cream “Key Highlights” checklist with check icons |
| Tags | `tags` | One chip under category + `#tag` row |
| Featured | `featured` | Featured story on feed (else first item) |
| **Image URL** | `imageUrl` (alias `heroImageUrl`) | Hero cover + feed/card artwork |
| Access Free/Paid | `access` + `commercialMode` | Gates body + highlights behind unlock card |
| Id | `id` | Stable; deep links / bookmarks / `targetKind: news` |

### Rules

1. **Stable `id`** on first save (e.g. `news-1` or slug-based). Never rename after publish.
2. **`categoryId` must exist** in published categories. Block publish otherwise.
3. **Image**: prefer required for Featured articles. HTTPS CDN URL only. Upload writes the URL; do not store binary in the article row. Without `imageUrl`, the app shows a category icon on a gradient hero.
4. **Key Highlights**: 2–6 items, each one short line (aim ≤ 120 chars). Empty highlights hide the Key Highlights card; do not send `[""]`.
5. **Body**: at least one non-empty paragraph to publish. Store as ordered string array (not one HTML blob) so the app maps 1:1 to paragraphs.
6. **Excerpt** required for publish — used on cards and share.
7. **Featured**: allow multiple `featured: true` in admin; learner feed picks the first featured in list order, else the first article. Show a soft warning when more than one is featured in the same category view.
8. **Free** → guests and signed-in users get `access.granted` for body + highlights. **Paid** → list/excerpt/image may show; body + highlights only when entitlement exists. Never rely on a hidden client field for access.
9. **Edit anytime** in Draft. After Publish, all content fields stay editable; Save updates `GET /news` and `GET /news/{id}` immediately (or after schedule). Confirm copy: “Learners will see these changes on next refresh.”
10. Changing title / image / highlights must **not** change `id`, bookmarks, notification targets, or banner `targetKind: news` / `targetRef`.
11. **Unpublish / archive** removes the article from learner list and detail (404 or empty). Keep admin history + audit.
12. Reading minutes: if staff leave blank, server may derive from body word count; if set, that value wins.

### Learner payload (list item — `GET /news`)

```json
{
  "id": "news-1",
  "categoryId": "news-national",
  "title": "RBI keeps repo rate unchanged for third review",
  "byline": "RACI News Desk",
  "publishedAt": "2026-11-17T04:00:00.000Z",
  "readingMinutes": 3,
  "excerpt": "The central bank held rates steady as inflation stayed within the target band.",
  "tags": ["economy", "rbi"],
  "featured": true,
  "imageUrl": "https://cdn.example.com/news-1.jpg",
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

List may omit `body` / `highlights` (detail loads them). Including them is fine; the app ignores extras.

### Learner payload (detail — `GET /news/{id}`)

```json
{
  "id": "news-1",
  "categoryId": "news-national",
  "title": "RBI keeps repo rate unchanged for third review",
  "byline": "RACI News Desk",
  "publishedAt": "2026-11-17T04:00:00.000Z",
  "readingMinutes": 3,
  "excerpt": "The central bank held rates steady as inflation stayed within the target band.",
  "body": [
    "The Reserve Bank of India kept the repo rate unchanged…",
    "Officials pointed to cooling food prices and stable core inflation…"
  ],
  "highlights": [
    "Repo rate held at 6.5%",
    "Inflation within the target band",
    "Next policy review in December"
  ],
  "tags": ["economy", "rbi"],
  "featured": true,
  "imageUrl": "https://cdn.example.com/news-1.jpg",
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

When `access.granted` is false, still return title, excerpt, image, meta; omit or empty `body` and `highlights` so the unlock card shows (“Get the complete article, key highlights and exam-ready notes.”).

---

## 3. Image upload

| Rule | Detail |
|---|---|
| Formats | JPEG, PNG, WebP |
| Max size | Enforce a sane portal limit (e.g. 5 MB); reject larger with a clear error |
| Storage | Object storage + CDN; article stores only the public HTTPS URL |
| Aspect | Prefer ~16:9 or 3:2 for hero; admin crop optional |
| Alt text | Stored for accessibility / future web; app uses title as fallback label |
| Replace | Replacing image updates URL; old object may be GC’d per media policy |
| Clear | Clearing image sets `imageUrl` null — app falls back to category icon hero |

Reuse `/admin/media` if it already exists; do not invent a second upload stack for news only.

---

## 4. Preview (required)

On the article editor, show side-by-side (or tabbed) previews:

1. **Feed card** — image/scrim, title, excerpt snippet, reading time, category.
2. **Article hero** — full-bleed image (or icon fallback), “N MIN READ”.
3. **Key Highlights** — cream card with check rows, exactly as `NewsArticleScreen` renders when access is granted.

Preview must use the form’s current draft values (including unsaved edits).

---

## 5. Publish rules for learner API

- Only `lifecycle: "published"` articles inside their schedule window appear on `GET /news`.
- Sort: featured first (or admin `sortOrder` / `publishedAt` desc — pick one, document it, keep stable).
- Drop rows missing `id`, `title`, or `categoryId`, or whose category is not published.
- `GET /news/{id}` returns 404 for unpublished / archived / expired / unknown ids.
- `categoryId` on every article must exist in `GET /news/categories`.
- Changing title or category label never changes article `id` or category `id`.

---

## 6. Admin API shape (create / patch article)

```json
{
  "categoryId": "news-national",
  "title": "RBI keeps repo rate unchanged for third review",
  "byline": "RACI News Desk",
  "publishedAt": "2026-11-17T04:00:00.000Z",
  "readingMinutes": 3,
  "excerpt": "The central bank held rates steady as inflation stayed within the target band.",
  "body": [
    "The Reserve Bank of India kept the repo rate unchanged…",
    "Officials pointed to cooling food prices and stable core inflation…"
  ],
  "highlights": [
    "Repo rate held at 6.5%",
    "Inflation within the target band",
    "Next policy review in December"
  ],
  "tags": ["economy", "rbi"],
  "featured": true,
  "imageUrl": "https://cdn.example.com/news-1.jpg",
  "imageAlt": "RBI building exterior",
  "commercialMode": "free",
  "lifecycle": "published",
  "startsAt": null,
  "endsAt": null
}
```

Suggested routes (names illustrative):

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/admin/news/categories` | List / create |
| `GET/PATCH` | `/admin/news/categories/:id` | Read / update |
| `POST` | `/admin/news/categories/:id/publish` | Publish |
| `GET/POST` | `/admin/news/articles` | List / create |
| `GET/PATCH` | `/admin/news/articles/:id` | Read / update (full edit) |
| `POST` | `/admin/news/articles/:id/publish` | Publish |
| `POST` | `/admin/news/articles/:id/unpublish` | Unpublish |
| `POST` | `/admin/media` | Image upload → CDN URL |

Audit every create, edit (especially image + highlights), publish, unpublish, feature toggle, and archive.

---

## 7. Permissions

| Action | Permission (illustrative) |
|---|---|
| Create / edit draft articles & categories | `news.author` |
| Upload media | `media.upload` |
| Publish / unpublish / feature | `news.publish` |
| Archive | `news.publish` |

---

## Acceptance checklist

- [ ] Admin can seed the seven category ids above and publish them to `GET /news/categories`.
- [ ] Staff can create an article with **image**, **excerpt**, **body paragraphs**, and **2–6 key highlights**.
- [ ] Published article appears on `GET /news` with `imageUrl`; detail on `GET /news/{id}` includes `body` + `highlights`.
- [ ] Learner feed shows the image on cards; article screen shows hero image and the **Key Highlights** card.
- [ ] Editing title, image, or highlights after publish updates learner APIs without changing `id`.
- [ ] Paid articles hide body + highlights until `access.granted`; unlock copy still makes sense.
- [ ] Featured flag controls the featured story; missing image falls back to category icon hero.
- [ ] Invalid category, empty body, or non-HTTPS image cannot be published.
- [ ] Unpublished / archived articles disappear from learner list and detail.
- [ ] Every create, edit, publish, feature change, and archive is audited.

---

## Out of scope (phase 1)

- In-article rich HTML / embedded video players (body stays paragraph strings).
- Per-paragraph images inside the body.
- Auto-translate of body/highlights (do not claim EN copy is HI).
- Push notification composer (use the notifications module; target `news` + article id).
