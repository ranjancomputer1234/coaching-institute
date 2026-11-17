# Handover 15 — Admin: Amazing Facts (categories & facts)

Admin-web spec so staff can **create, edit, and publish** Amazing Facts categories and individual facts with **text**, **explanation**, **image**, **featured** flag, tags, source/rights, and an optional linked quiz — matching what the learner app already renders on `AmazingFacts`, `FactsList`, and `FactDetail`.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage content in admin; learners read published rows from `GET /facts/categories`, `GET /facts`, and `GET /facts/{id}`. Reactions use `PUT /facts/{id}/reaction` (learner-owned; not typed by staff).

Related: [09-explore-sections](./09-explore-sections.md) (Explore → Amazing Facts tile), learner contract: [05-amazing-facts.md](./05-amazing-facts.md), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §16.3. App type: `Fact` in `src/core/types.ts`. Screens: `src/screens/facts/*`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Add a fact category (Science, History, …) | Create category → title / summary / Free·Paid / icon → publish |
| Add a fact | Create fact → **text** + explanation + category → optional image / featured / quiz → publish |
| Change a live fact later | Edit any field (text, explanation, category, image, featured, tags, quiz); Save keeps learner payload in sync |
| Feature a fact on the hub | Toggle **Featured** (hub + list pick the first featured, else first item) |
| Link “Take a Quiz” / practice | Optional `quizId` → must be a **published** test |
| See what the app shows | Preview: category card + featured hero + list row + detail card |

Explore section `amazing-facts` only **navigates** to Amazing Facts. Publishing that Explore tile does **not** create categories or facts.

---

## Content model (what the app understands)

```
FactCategory                 ← grid cards on AmazingFacts hub
  └─ Fact[]                  ← featured hero + FactsList cards + FactDetail
        ├─ text              ← the one-liner on every card
        ├─ explanation?      ← detail body under the fact
        ├─ featured?         ← lead card on hub / list
        ├─ quizId?           ← “Practice this topic” / Take a Quiz
        ├─ reactionCount     ← server total (system-derived)
        ├─ reacted           ← this learner’s heart (not admin)
        └─ bookmarked        ← this learner’s save (not admin)
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Category** | Hub grid + filter for list | `AmazingFacts`, `FactsList` (`categoryId`) |
| **Fact** | Featured hero, list cards, detail | Hub, `FactsList`, `FactDetail` |

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/facts` | Fact list (default landing) |
| `/admin/facts/new`, `/admin/facts/:id` | Create / edit / publish fact |
| `/admin/facts/categories` | Category list |
| `/admin/facts/categories/new`, `/admin/facts/categories/:id` | Create / edit / publish category |

Also allow **Add fact** from Category edit → Facts tab (category pre-filled).  
Every category and every fact must stay **fully editable** after publish. Editing never changes published `id`s.

---

## 1. Categories

### Preferred stable ids

Seed these when possible; **do not rename ids after publish**. Facts store `categoryId` against these values.

| Stable id | Suggested title | Suggested `iconKey` | Theme / clay |
|---|---|---|---|
| `facts-science` | Science | `bulb` | `green` |
| `facts-history` | History | `book` | `lavender` |
| `facts-nature` | Nature | `leaf` | `mint` |
| `facts-space` | Space | `planet` | `purple` |
| `facts-human-body` | Human body | `heart` | `rose` |
| `facts-world` | World & places | `globe` | `cyan` |
| `facts-tech` | Tech & inventions | `chip` | `blue` |
| `facts-fun` | Fun & odd | `spark` | `orange` |

Extra category ids are allowed; unknown icons fall back to `bulb` in the mapper.

### List columns

| Column | Shows |
|---|---|
| Title | Category title |
| Id | Stable id (read-only after create) |
| Facts | Count of **published** facts |
| Access | Free / Paid |
| Order | `sortOrder` |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, unpublish, archive |

Filters: All · Free · Paid · Published · Draft. Search title / summary / keywords.

### Create / edit form

```
Category
  Id *                 [ facts-science                 ]  ← editable only while draft / first save
  Title *              [ Science                       ]
  Summary              [ Short science facts…          ]  ← hub card subtitle
  Icon key             [ bulb                          ]
  Theme / clay         [ green                         ]
  Cover image URL      [ https://cdn…/science.jpg      ]  ← optional HTTPS
  Keywords             [ science, physics, biology     ]
  Sort order           [ 10                            ]
  Access               ( • Free )  ( ○ Paid )
  Product id (if Paid) [ optional product for checkout ]
  Lifecycle            Draft | Published | Archived
```

### Rules

1. **Stable `id`** after first publish. Hub routes, list filters, and fact `categoryId` use it.
2. Publish requires title + id. Prefer warning if zero published facts.
3. Archiving a category must **block** if published facts still point at it (or force reassign first).
4. **Free** categories appear for guests; **Paid** show a premium badge / lock affordance on the hub card (`access.granted` false until entitlement).

### Learner payload (category — `GET /facts/categories`)

```json
{
  "id": "facts-science",
  "title": "Science",
  "summary": "Short science facts",
  "pricing": "free",
  "commercialMode": "free",
  "iconKey": "bulb",
  "themeKey": "green",
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

If `/facts/categories` is missing, the app derives chips from distinct `categoryId` values on `GET /facts` — publish real categories so titles are names, not raw ids.

---

## 2. Facts (fully editable)

Every fact must be editable after publish: text, explanation, category, image, featured flag, tags, source, quiz link, and access. Editing never changes `id`.

### List columns

| Column | Shows |
|---|---|
| Text | Truncated fact sentence |
| Category | Category title |
| Image | Thumb or “No image” |
| Featured | Yes / — |
| Reactions | Live `reactionCount` (read-only) |
| Quiz | Linked test id or — |
| Access | Free / Paid |
| Status | Draft / Published / Scheduled / Archived |
| Actions | Edit, duplicate, publish, unpublish, archive |

Filters: category, featured, Free/Paid, has quiz, status. Search text, explanation, tags, source.

### Create / edit form

```
Fact
  Text *                  [ Honey never spoils.                    ]  ← one learner-facing sentence
  Explanation             [ Low water activity and acidity…        ]  ← detail body (optional but recommended)
  Category *              [ Science                              ▼ ]  ← must be a published category

Presentation
  Featured                [ ✓ ]   ← hub / list lead card
  Image URL               [ https://cdn…/honey.jpg                 ]  ← optional HTTPS (store for rights / future UI)
  Alt text                [ Jar of honey                           ]
  [ Upload… ]             ← stores to CDN; writes Image URL
  [ Clear image ]

Discovery
  Tags                    [ food, chemistry, history               ]
  Source / rights         [ Smithsonian / public domain note…      ]  ← admin + compliance; not required on learner card
  Locale                  [ en                                     ]
  Keywords                [ honey, spoilage                        ]  ← search / admin find

Quiz (optional)
  Linked quiz / test      [ test-daily-science-01                ▼ ]  ← only published tests; Clear allowed
                          ← “Take a Quiz” / “Practice this topic” only when set

Access
  ( • Free )  ( ○ Paid )
  Product id (if Paid)    [ optional product for checkout ]

Reactions (read-only)
  Reaction count          [ 18 ]   ← system-derived; do NOT offer a free-type marketing field
  [ Moderate… ]           ← optional: clear suspicious spikes; never “set to 10k for launch”

Schedule / lifecycle
  Lifecycle               Draft | Published | Scheduled | Archived
  Starts at / Ends at     [ optional window ]
```

### Field → app mapping

| Admin field | Learner field | App use |
|---|---|---|
| Id | `id` | Detail route, reaction route, bookmarks, `targetKind: fact` |
| Category | `categoryId` | Hub filter + `FactsList` |
| **Text** | `text` (fallback `title`) | Featured hero, list cards, detail headline, share |
| Explanation | `explanation` | Detail body under the fact |
| Featured | `featured` | Hub + list lead card (else first item) |
| Quiz | `quizId` (alias `relatedQuizId`) | “Practice this topic” / Take a Quiz → `TestInstructions` |
| Image URL | `imageUrl` | Optional; current mobile UI uses illustration art — still store HTTPS URL for admin preview, web, and future client |
| Tags / keywords | (index + admin) | Search; optional future chips |
| Source / rights | (admin only ok) | Compliance; do not invent fake citations on the card |
| Reaction count | `reactionCount` | Heart count — **server total only** |
| Reacted / bookmarked | `reacted`, `bookmarked` | Per-learner; guests get `false` |
| Access Free/Paid | `access` + `commercialMode` | Gate list/detail when paid |

### Rules

1. **Stable `id`** on first save (e.g. `fact-honey` or slug-based). Never rename after publish — deep links, bookmarks, notifications, and Explore `fact:{id}` use it.
2. **`categoryId` must exist** in published categories. Block publish otherwise.
3. **`text` required** for publish — this is the learner-facing sentence. Do not force the app to join a separate title + body. Prefer ~40–160 characters; warn above ~220.
4. **Explanation** optional but recommended for detail. Empty explanation is fine; do not send `" "`.
5. **Featured**: allow multiple `featured: true` in admin; learner hub/list picks the **first featured** in list order, else the first fact. Soft-warn when more than one is featured in the same category view.
6. **`quizId`**: omit or `null` unless the test is **published** and accessible. A dangling id opens a broken quiz. “Take a Quiz” appears **only** when a valid id is present.
7. **`reactionCount`**: system-derived from `fact_reactions`. Admin may moderate abusive spikes; **cannot** casually type a marketing count. Always return a number (`0`, never `null`).
8. **Image**: HTTPS CDN URL only when set. Upload writes the URL; do not store binary in the fact row. Current mobile screens do not require image to publish.
9. **Free** → guests and signed-in users get the fact. **Paid** → category/list may show a lock; detail must not leak full text until `access.granted` (return metadata + locked state, or omit `text`/`explanation` per product policy — pick one, document it, keep honest).
10. **Edit anytime** in Draft. After Publish, all content fields stay editable; Save updates `GET /facts` and `GET /facts/{id}` immediately (or after schedule). Confirm copy: “Learners will see these changes on next refresh.”
11. Changing text / explanation / featured / quiz must **not** change `id`, bookmarks, reaction history, or banner `targetKind: fact` / `targetRef`.
12. **Unpublish / archive** removes the fact from learner list and detail (404 or empty). Keep admin history + audit. Prefer archive over hard-delete.
13. Sort for learner list: **featured first**, then newest (`publishedAt` desc) — keep stable and document it.

### Learner payload (list / detail — `GET /facts`, `GET /facts/{id}`)

```json
{
  "id": "fact-honey",
  "categoryId": "facts-science",
  "text": "Honey never spoils.",
  "explanation": "Low water activity and natural acidity keep most bacteria from growing.",
  "reactionCount": 18,
  "reacted": false,
  "bookmarked": false,
  "featured": true,
  "quizId": null,
  "imageUrl": "https://cdn.example.com/facts/honey.jpg",
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

Query on list: `categoryId`, `cursor`. A bare array is accepted. Detail returns the same object shape for one id.

---

## 3. Reactions (not an authoring field)

| Rule | Detail |
|---|---|
| Write path | Learner `PUT /facts/{id}/reaction` with `{ "reacted": true \| false }` (auth required) |
| Idempotent | Same value twice does not double-count |
| Response | Updated fact including new `reactionCount` and `reacted` |
| Admin | Read-only count on the fact form; optional moderation tool for abuse |
| Guests | App blocks before the call; API should also reject unauthenticated writes |

Do not expose a “set reaction count” input on the create/edit form.

---

## 4. Image upload

| Rule | Detail |
|---|---|
| Formats | JPEG, PNG, WebP |
| Max size | Enforce a sane portal limit (e.g. 5 MB) |
| Storage | Object storage + CDN; fact stores only the public HTTPS URL |
| Replace / clear | Updates or nulls `imageUrl`; old object GC per media policy |

Reuse `/admin/media` if it already exists; do not invent a second upload stack for facts only.

---

## 5. Preview (required)

On the fact editor, show side-by-side (or tabbed) previews using **current draft** values:

1. **Category card** — icon/clay, title, summary, FREE/PREMIUM (when editing from category, or show selected category).
2. **Featured hero** — fact `text`, short explanation teaser, heart count placeholder.
3. **List row** — sentence + reaction / save affordances.
4. **Detail card** — full `text` + `explanation` + “Practice this topic” button only when `quizId` is set.

Preview must reflect unsaved form state.

---

## 6. Publish rules for learner API

- Only `lifecycle: "published"` categories appear on `GET /facts/categories`.
- Only `lifecycle: "published"` facts inside their schedule window appear on `GET /facts`.
- Drop facts missing `id`, `text`/`title`, or `categoryId`, or whose category is not published.
- `GET /facts/{id}` returns 404 for unpublished / archived / expired / unknown ids.
- `categoryId` on every fact must exist in `GET /facts/categories` (when that route is published).
- Changing category title never changes category `id` or fact `id`.
- Global search index must include fact `text` + `explanation` (+ tags) for published content; remove archived facts promptly.
- Daily practice `GET /practice/daily?kind=facts` must resolve to a real published test when the hub “Daily challenge” is used — that is separate from per-fact `quizId`.

---

## 7. Admin API shape (create / patch fact)

```json
{
  "categoryId": "facts-science",
  "text": "Honey never spoils.",
  "explanation": "Low water activity and natural acidity keep most bacteria from growing.",
  "featured": true,
  "imageUrl": "https://cdn.example.com/facts/honey.jpg",
  "imageAlt": "Jar of honey",
  "tags": ["food", "chemistry"],
  "source": "Editorial research note / rights line",
  "locale": "en",
  "keywords": ["honey", "spoilage"],
  "quizId": null,
  "commercialMode": "free",
  "lifecycle": "published",
  "startsAt": null,
  "endsAt": null
}
```

Suggested routes (names illustrative):

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/admin/facts/categories` | List / create |
| `GET/PATCH` | `/admin/facts/categories/:id` | Read / update |
| `POST` | `/admin/facts/categories/:id/publish` | Publish |
| `POST` | `/admin/facts/categories/:id/unpublish` | Unpublish |
| `GET/POST` | `/admin/facts` | List / create |
| `GET/PATCH` | `/admin/facts/:id` | Read / update (full edit) |
| `POST` | `/admin/facts/:id/publish` | Publish |
| `POST` | `/admin/facts/:id/unpublish` | Unpublish |
| `POST` | `/admin/facts/:id/archive` | Archive |
| `POST` | `/admin/media` | Image upload → CDN URL |
| `POST` | `/admin/facts/:id/reactions/moderate` | Optional abuse reset (not a free-form count setter) |

Audit every create, edit (especially text / featured / quiz link), publish, unpublish, feature toggle, and archive.

---

## 8. Permissions

| Action | Permission (illustrative) |
|---|---|
| Create / edit draft facts & categories | `facts.author` |
| Upload media | `media.upload` |
| Publish / unpublish / feature | `facts.publish` |
| Moderate reactions | `facts.moderate` |
| Archive | `facts.publish` |

---

## Acceptance checklist

- [ ] Admin can seed the preferred `facts-*` category ids and publish them to `GET /facts/categories`.
- [ ] Staff can create a fact with **text**, optional **explanation**, **category**, **featured**, optional **image**, tags/source, and optional **quizId**.
- [ ] Published fact appears on `GET /facts`; detail on `GET /facts/{id}` matches the list shape.
- [ ] Hub shows category grid; featured fact leads the hero; category open filters `GET /facts?categoryId=`.
- [ ] Editing text, explanation, featured, or quiz after publish updates learner APIs **without** changing `id`.
- [ ] “Practice this topic” / Take a Quiz shows only when `quizId` points at a published test.
- [ ] Reaction count is system-derived; admin cannot casually type a marketing count.
- [ ] Invalid category, empty text, or dangling quiz id cannot be published.
- [ ] Unpublished / archived facts disappear from learner list and detail.
- [ ] Every create, edit, publish, feature change, quiz link change, and archive is audited.

---

## Out of scope (phase 1)

- Staff-typed fake reaction counts for marketing.
- Per-fact rich HTML / embedded video (keep plain text + explanation).
- Auto-translate of fact text (do not claim EN copy is HI).
- Push notification composer (use notifications module; target `fact` + fact id).
- Changing Explore tile copy (that is the Explore sections module).

---

## Smoke path

```
1. Admin → Amazing Facts → Categories → New
2. Id facts-science, title Science, Free → Publish
3. Facts → New → text “Honey never spoils.”, explanation, category Science, Featured → Publish
4. Learner: Explore → Amazing Facts → featured hero + Science card → FactsList → FactDetail
5. Signed-in learner hearts the fact → reactionCount increments
6. Edit explanation in admin → Save → pull-to-refresh in app → new explanation
```
