# Handover 14 — Admin: General Awareness (topics & entries)

Admin-web spec so staff can **create, edit, and publish** General Awareness topics with ordered **study entries** (pairs / list / article schemas), summary chips, Free·Paid access, and icons — matching what the learner app already renders on `GeneralAwareness` and `TopicDetail`.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage content in admin; learners read published rows from `GET /awareness/topics` and `GET /awareness/topics/{id}`.

Related: [09-explore-sections](./09-explore-sections.md) (Explore → General Awareness tile), learner contract: [04-general-awareness.md](./04-general-awareness.md) (restore from git if missing on disk), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §16.2. App type: `AwarenessTopic` in `src/core/types.ts`. Screens: `src/screens/awareness/*`.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Add a GK topic (States & Capitals, Rivers, …) | Create topic → title / summary / schema / Free·Paid → publish |
| Fill the topic with study cards | Add ordered **entries** (label + value) → reorder → save |
| Change a live topic later | Edit any field (title, chips, entries, access, image); Save keeps learner payload in sync |
| Group entries (e.g. State vs UT) | Optional `group` per entry |
| Gate paid guides | Access: Free or Paid (same honesty rules as courses/news) |
| See what the app shows | Preview: hub card + topic hero + Learn / Browse / Quiz cards |

Explore section `general-awareness` only **navigates** to the topic hub. Publishing that Explore tile does **not** create topics or entries.

---

## Content model (what the app understands)

```
AwarenessTopic                 ← cards on GeneralAwareness hub
  ├─ schema                    ← pairs | list | article
  ├─ summaryChips[]            ← short labels under the hero title
  └─ entries[]                 ← study cards (Learn / Browse / Quiz)
        ├─ label               ← prompt / left side (e.g. “Bihar”)
        ├─ value               ← answer / right side (e.g. “Patna”)
        ├─ group?              ← optional section tag (e.g. “State”)
        └─ iconColor?          ← accent hex on the card
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Topic** | Catalogue card + study guide shell | `GeneralAwareness`, `TopicDetail` hero |
| **Entry** | One flashcard / quiz item | Learn focus cards, Browse list, Quick quiz |

List payload must **not** embed `entries`. Detail owns the entries.

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/awareness` | Topic list (default landing) |
| `/admin/awareness/new`, `/admin/awareness/:id` | Create / edit / publish topic + entries |
| `/admin/awareness/:id/entries` | Optional focused entry editor (or Entries tab on topic edit) |

Also allow **Add entry** from Topic edit → Entries tab (topic pre-filled).  
Every topic and every entry must stay **fully editable** after publish (title, chips, schema presentation, entry text, order, access, image). Editing never changes published `id`s.

---

## 1. Topics

### Preferred stable ids (hub track chips)

The learner hub hard-codes track filters for these ids. Seed them when possible; **do not rename ids after publish**.

| Stable id | Suggested title | Hub track |
|---|---|---|
| `aw-states-uts` | States & Union Territories | Geography |
| `aw-capitals` | Capitals | Geography |
| `aw-rivers` | Rivers | Geography |
| `aw-dams` | Dams | Geography |
| `aw-wildlife` | Wildlife | Geography |
| `aw-parks` | National parks | Geography |
| `aw-mountains` | Mountains | Geography |
| `aw-lakes` | Lakes | Geography |
| `aw-geo` | Geography essentials | Geography |
| `aw-constitution` | Constitution | Governance |
| `aw-polity` | Polity | Governance |
| `aw-economy` | Economy | Governance |
| `aw-history` | History | History & culture |
| `aw-culture` | Culture | History & culture |
| `aw-awards` | Awards | Quick facts |
| `aw-days` | Important days | Quick facts |

Extra topic ids are allowed; unknown ids still appear under **All topics** (no track chip match).

### List columns

| Column | Shows |
|---|---|
| Title | Topic title |
| Id | Stable id (read-only after create) |
| Schema | `pairs` / `list` / `article` |
| Entries | Count of **published** entries |
| Access | **Free** or **Paid** |
| Status | Draft / Published / Archived |
| Order | `sortOrder` |
| Actions | Edit, publish, unpublish, archive |

Filters: All · Free · Paid · Published · Draft · by schema. Search title / summary / keywords. Sort by `sortOrder` or title.

### Create / edit form

```
Topic
  Id *                 [ aw-capitals                      ]  ← editable only while draft / first save
  Title *              [ States and Capitals              ]
  Summary              [ Indian states & UTs…             ]  ← hub card subtitle
  Schema *             ( • pairs )  ( ○ list )  ( ○ article )
  Icon key             [ book                             ]
  Theme / clay         [ lavender                         ]
  Cover image URL      [ https://cdn…/capitals.jpg        ]  ← optional HTTPS
  Summary chips        [ 28 states ] [ 8 UTs ] [ + Add ]
  Keywords             [ capital, state, india            ]  ← search / admin find
  Sort order           [ 10                               ]
  Access               ( • Free )  ( ○ Paid )
  Product id (if Paid) [ optional product for checkout    ]
  Lifecycle            Draft | Published | Archived
```

### Entries tab (ordered, fully editable)

```
Entries  (teaching order — app does not re-sort)
  1. Id        [ entry-bihar     ]   ← stable; editable only while draft / first save
     Label *   [ Bihar           ]
     Value *   [ Patna           ]   ← alias `text` accepted by learner mapper
     Group     [ State           ]
     Color     [ #1A237E         ]
  2. …
  [ + Add entry ]   [ Reorder drag ]   [ Duplicate ]   [ Delete ]
```

Inline edit of label/value/group/color must work for **published** topics without forcing unpublish.

### Field → app mapping

| Admin field | Learner field | App use |
|---|---|---|
| Id | `id` | Hub card, `TopicDetail` route, bookmarks, `targetKind: topic` |
| Title | `title` | Hub card + hero title |
| Summary | `summary` / `subtitle` | Hub subtitle |
| Schema | `schema` | `pairs` \| `list` \| `article` (unknown → treated as `pairs`) |
| Summary chips | `summaryChips` | Chips under hero title |
| Icon key | `iconKey` | Bundled icon (fallback `book`) |
| Image URL | `imageUrl` | Optional art |
| Access Free/Paid | `pricing` / `commercialMode` + `access` | Paid badge; locked guide empty state |
| Entry id | `entries[].id` | Device mastery / reveal state — **must stay stable** |
| Entry label | `entries[].label` | Learn prompt / Browse left side / quiz stem |
| Entry value | `entries[].value` (or `text`) | Revealed answer / quiz correct option |
| Entry group | `entries[].group` | Shown beside label / section mark |
| Entry color | `entries[].iconColor` | Card accent |

### Schema guidance (validate before publish)

| Schema | When to use | Entry expectations |
|---|---|---|
| **`pairs`** | Label ↔ value flashcards (State/Capital, Day/Date) | Both `label` and `value` required; quiz uses other entries’ values as distractors |
| **`list`** | Ordered facts / checklist | Prefer clear `label` (item name) + `value` (detail); empty values blocked on publish |
| **`article`** | Longer revision notes still delivered as cards | Same entry shape; keep values readable as short paragraphs, not HTML |

Do not invent a separate rich-text body for phase 1 — the app study UI is entry-based for all three schemas.

### Rules

1. **Stable `id`** after first save (prefer `aw-…` seeds above). Never rename after publish — deep links, Explore `awareness-topic:{id}`, bookmarks, and hub track maps use it.
2. **Stable entry `id`s** across edits. The app stores mastered/opened entry ids on device. Renaming an entry id resets learner progress for that card.
3. **Order** = teaching order. Reorder in admin; learner API returns the same order.
4. **Publish requires** title + schema + at least **one** non-empty entry (`label` and `value`/`text`). Publishing an empty topic creates the hub “coming soon / no study cards” state — block or hard-warn.
5. Do not send empty placeholder entries (`label: ""`, `value: ""`) in the learner payload.
6. **Free** → guests and signed-in users get `access.granted` and full `entries`. **Paid** → hub card may show with paid badge; detail returns title + `access.granted: false` and **empty `entries`** (never leak answers).
7. **Edit anytime** in Draft. After Publish, all content fields stay editable; Save updates `GET /awareness/topics` and `GET /awareness/topics/{id}` immediately. Confirm copy: “Learners will see these changes on next refresh.”
8. Changing title / chips / entries must **not** change topic `id` or entry `id`s (unless staff explicitly recreate an entry).
9. **Unpublish / archive** removes the topic from the hub and makes detail 404 (or empty). Prefer archive over hard-delete.
10. Hub list search is title + summary (server). In-topic search is **label and value** on the device from the detail payload — index both for global search too.
11. Prefer **not** embedding `entries` on `GET /awareness/topics` (list). Detail owns entries.

### Learner payload (list item — `GET /awareness/topics`)

```json
{
  "id": "aw-capitals",
  "title": "States and Capitals",
  "summary": "Indian states and union territories",
  "pricing": "free",
  "commercialMode": "free",
  "iconKey": "book",
  "imageUrl": null,
  "sortOrder": 10,
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

### Learner payload (detail — `GET /awareness/topics/{id}`)

```json
{
  "id": "aw-capitals",
  "title": "States and Capitals",
  "summary": "Indian states and union territories",
  "pricing": "free",
  "commercialMode": "free",
  "schema": "pairs",
  "summaryChips": ["28 states", "8 union territories"],
  "iconKey": "book",
  "imageUrl": null,
  "entries": [
    {
      "id": "entry-bihar",
      "label": "Bihar",
      "value": "Patna",
      "group": "State",
      "iconColor": "#1A237E"
    },
    {
      "id": "entry-delhi",
      "label": "Delhi",
      "value": "New Delhi",
      "group": "UT",
      "iconColor": "#0D47A1"
    }
  ],
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false,
    "reason": null,
    "source": "free"
  }
}
```

When `access.granted` is false, still return `id`, `title`, `summary`, meta; return `entries: []` so the app shows “This guide is locked” without leaking answers.

---

## 2. Entries (fully editable)

Treat entries as first-class editable rows under a topic (table `awareness_entries` or embedded ordered JSON — either is fine if learner shape matches).

| Action | Behaviour |
|---|---|
| Add | New stable `id` (e.g. `entry-bihar` or uuid); append to end or insert at index |
| Edit | Change label / value / group / color; keep `id` |
| Reorder | Drag; persists `sortOrder` or array order |
| Duplicate | New `id`, copy fields; does not copy learner mastery |
| Delete / retire | Remove from published payload; prefer soft-delete in admin history |
| Bulk paste | Optional: CSV / TSV `label,value,group` → creates many draft entries |

### Validation

- Label required (trim).
- Value required (trim); accept admin field `text` mapped to learner `value`.
- `iconColor` if set: valid `#RRGGBB` or `#RGB`.
- At least **2** entries recommended before enabling a useful Quick quiz (app disables quiz when `entries.length <= 1`).
- For `pairs`, warn if many duplicate `value`s (weak quiz distractors).

---

## 3. Preview (required)

On the topic editor, show side-by-side (or tabbed) previews using **current draft** values:

1. **Hub card** — icon/clay, title, summary, FREE/PAID badge.
2. **Topic hero** — title, entry count copy, summary chips, progress placeholder.
3. **Learn card** — first entry label → reveal value, accent color.
4. **Browse row** — label + tap-to-reveal value (+ group mark).

Preview must reflect unsaved form state.

---

## 4. Publish rules for learner API

- Only `lifecycle: "published"` topics appear on `GET /awareness/topics`.
- Drop rows missing `id` or `title`.
- Detail returns 404 for unpublished / archived / unknown ids.
- Detail with denied access: metadata + empty `entries`.
- Changing title never changes topic `id`.
- Changing entry text never changes entry `id` unless staff create a replacement entry.
- Global search index must include topic title/summary **and** entry label + value for published free (and authorized paid) content; remove archived topics promptly.

---

## 5. Admin API shape (create / patch topic)

```json
{
  "title": "States and Capitals",
  "summary": "Indian states and union territories",
  "schema": "pairs",
  "summaryChips": ["28 states", "8 union territories"],
  "iconKey": "book",
  "themeKey": "lavender",
  "imageUrl": null,
  "keywords": ["capital", "state", "india"],
  "sortOrder": 10,
  "commercialMode": "free",
  "lifecycle": "published",
  "entries": [
    {
      "id": "entry-bihar",
      "label": "Bihar",
      "value": "Patna",
      "group": "State",
      "iconColor": "#1A237E",
      "sortOrder": 1
    }
  ]
}
```

Suggested routes (names illustrative):

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/admin/awareness/topics` | List / create |
| `GET/PATCH` | `/admin/awareness/topics/:id` | Read / update (full edit, including entries) |
| `POST` | `/admin/awareness/topics/:id/publish` | Publish |
| `POST` | `/admin/awareness/topics/:id/unpublish` | Unpublish |
| `POST` | `/admin/awareness/topics/:id/archive` | Archive |
| `PUT` | `/admin/awareness/topics/:id/entries/reorder` | Optional dedicated reorder |
| `POST` | `/admin/media` | Optional cover upload → CDN URL |

Audit every create, edit (especially entry text changes), reorder, publish, unpublish, access change, and archive.

---

## 6. Permissions

| Action | Permission (illustrative) |
|---|---|
| Create / edit draft topics & entries | `awareness.author` |
| Upload media | `media.upload` |
| Publish / unpublish | `awareness.publish` |
| Archive | `awareness.publish` |

---

## Acceptance checklist

- [ ] Admin can seed the preferred `aw-*` topic ids and publish them to `GET /awareness/topics`.
- [ ] Staff can create a topic with schema, summary chips, Free/Paid, and ordered entries (label + value + optional group/color).
- [ ] Published topic appears on the hub; detail on `GET /awareness/topics/{id}` includes `schema`, `summaryChips`, and `entries`.
- [ ] Editing title, chips, or entry text after publish updates learner APIs **without** changing topic or entry `id`s.
- [ ] Reordering entries changes Learn / Browse / Quiz order in the app.
- [ ] In-topic search matches both label and value (e.g. state **and** capital).
- [ ] Paid topics hide entry answers until `access.granted`; locked copy still makes sense.
- [ ] Topics with zero entries cannot publish (or show a blocking warning).
- [ ] Unpublished / archived topics disappear from the hub and detail.
- [ ] Quiz needs ≥ 2 entries; admin warns when fewer.
- [ ] Every create, edit, reorder, publish, and archive is audited.

---

## Out of scope (phase 1)

- Rich HTML / Markdown article bodies separate from `entries`.
- Per-entry images or audio.
- Server-authored quiz distractors (app derives distractors from sibling entry values).
- Auto-translate of labels/values (do not claim EN copy is HI).
- Push notification composer (use notifications module; target `topic` + topic id).
- Changing the hardcoded hub track map in the mobile app (new ids simply land under All topics until a mobile update).

---

## Smoke path

```
1. Admin → General Awareness → New topic
2. Id aw-capitals, schema pairs, Free, chips “28 states” / “8 UTs”
3. Add entries (Bihar→Patna, Delhi→New Delhi, …) → Publish
4. Learner: Explore → General Awareness → card → TopicDetail
   Learn reveal, Browse search “Patna”, Quick quiz
5. Edit an entry value in admin → Save → pull-to-refresh in app → new value
```
