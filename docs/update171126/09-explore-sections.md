# Handover 9 — Explore sections

Home Explore and the Explore Sections screen are the learner’s directory of learning paths. Each tile is only a navigation entry. Publishing an Explore section does not create courses, exams, news, facts, topics, or interview questions. Those catalogues are separate — see handovers 01–06.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`. Create and publish Explore sections in the admin panel, then expose the published rows on the learner `GET /home` (and `GET /home/me`) `sections` array.

## What the app shows today

| Surface | Source today | Notes |
|---|---|---|
| Home → Explore grid | Hardcoded `exploreOptions` in `src/features/catalog/exploreOptions.ts` | Six tiles: Computer Courses, Competitive Exam, News, General Awareness, Amazing Facts, Interview Prep |
| Explore Sections (`ExploreSections`) | Same hardcoded list | Search filters title, subtitle, description, and highlights (EN + HI UI strings) |
| Home API `sections` | Parsed from `GET /home` into `CatalogItem[]` | Ready for admin-driven tiles; keep the same six stable targets so deep links and banners stay valid |

Until the client switches the Home/Explore UI to the API list, admin must still publish the six sections below so `sections` on `/home` matches what learners already see, and so banners / notifications that target a section keep working.

## Screens

- Home Explore (`src/screens/home/HomeScreen.tsx` + `ExploreHomeGrid`)
- Explore directory (`src/screens/catalog/ExploreSectionsScreen.tsx` + `ExploreDetailCard`)

Home tiles show title + icon + clay colour.  
Explore directory cards show title, subtitle, description, highlight chips, icon, and clay colour. Tap opens the matching catalogue screen.

## Six sections the admin must seed

Keep these **stable ids / slugs**. Titles may be renamed later; ids must not change.

| Stable id / slug | Title | Subtitle | Description | Highlights | `iconKey` | `themeKey` (clay) | `targetKind` | `targetRef` |
|---|---|---|---|---|---|---|---|---|
| `computer-courses` | Computer Courses | Skills, one lesson at a time | Guided computer lessons, from everyday tools to job-ready skills. Start free or continue with a paid course. | Lessons · Free & paid · Step by step | `monitor` | `blue` | `catalog` | `course` |
| `competitive-exam` | Competitive Exam | Prepare with a clear plan | Syllabus, practice sets, and exam paths together, so preparation has a clear next step. | Syllabus · Practice sets · Exam paths | `trophy` | `orange` | `catalog` | `exam` |
| `news` | News | Stay current, every day | Short daily stories written for learners — easy to read now and easy to find again. | Daily brief · Topics · Saved stories | `news` | `cyan` | `catalog` | `news` |
| `general-awareness` | General Awareness | GK you can revise quickly | Static general knowledge, organised by topic, for the exams that ask it again and again. | By subject · Quick revise · Exam GK | `globe` | `green` | `catalog` | `topic` |
| `amazing-facts` | Amazing Facts | Curious reads, one fact at a time | Science, history, nature, and the world — memorable facts in a quick read. | Science · History · Quick reads | `bulb` | `purple` | `catalog` | `fact` |
| `interview-prep` | Interview Prep | Practice before you walk in | Question sets and model answers, so the interview is practice and not a surprise. | Question sets · Model answers · HR and technical | `mic` | `mint` | `catalog` | `interview` |

Optional pricing variants the app already understands (for free/paid computer-course entry points):

| Purpose | `targetKind` | `targetRef` | `pricingFilter` |
|---|---|---|---|
| All computer courses | `catalog` | `course` | `all` |
| Free computer courses | `catalog` | `course,free` | `free` |
| Paid computer courses | `catalog` | `course,paid` | `paid` |

Do not invent a seventh “main” Explore path unless product explicitly adds a new catalogue screen. Extra rows are allowed only when they target a supported destination below.

## Payload

Sections are the `sections` array on `GET /home` / `GET /home/me`.

```json
{
  "sections": [
    {
      "id": "computer-courses",
      "title": "Computer Courses",
      "description": "Skills, one lesson at a time",
      "badge": null,
      "category": "learn",
      "iconKey": "monitor",
      "themeKey": "blue",
      "imageUrl": null,
      "targetKind": "catalog",
      "targetRef": "course",
      "pricingFilter": "all",
      "highlights": ["Lessons", "Free & paid", "Step by step"],
      "searchKeywords": ["computer", "tally", "ms office", "skills"],
      "sortOrder": 10,
      "lifecycle": "published",
      "homeVisible": true
    }
  ]
}
```

### Fields the learner app already maps

| Field | Required | App use |
|---|---|---|
| `id` | yes | Stable section identity. Never change after publish |
| `title` | yes | Tile / card title |
| `description` | no | Mapped to subtitle on the home catalogue item |
| `iconKey` | no | Bundled icon name. Falls back to `book`. Alias: `computer` → `monitor`, `calculator` → `chart` |
| `themeKey` | no | Clay colour. Allowed values below. Alias: `teal` → `mint`. Unknown → `blue` |
| `imageUrl` | no | Optional raster image URL (HTTPS) |
| `targetKind` | yes for navigation | Used with `targetRef` by `openPublishedTarget` |
| `targetRef` | yes for navigation | Catalogue key, filter, or record id — see Target table |
| `pricingFilter` | no | `all` (default), `free`, or `paid`. Wins over a pricing suffix in `targetRef` when both are set |
| `badge` | no | Stored by admin; not drawn on the current Home Explore grid |
| `category` | no | Admin grouping: prefer `learn`, `prepare`, or `discover` |

### Fields the admin should also store (for Explore directory / future API-driven cards)

| Field | Required | Purpose |
|---|---|---|
| `subtitle` | yes for directory cards | Short line under the title (app hardcodes this today) |
| `body` / long `description` | yes for directory cards | Paragraph on the Explore detail card |
| `highlights` | yes for directory cards | 2–4 short chips |
| `searchKeywords` | no | Admin + future API search |
| `sortOrder` | yes | Ascending order returned to the app |
| `homeVisible` | yes | Whether the section is eligible for the Home Explore grid |
| `lifecycle` | yes | Only `published` rows belong on learner `/home` |
| `startsAt` / `endsAt` | no | Schedule window |
| `minAppVersion` | no | Hide from older clients |
| `audience` | no | everyone / guests / authenticated / segment |

Return sections **already sorted**. The app shows the array in the order received.

## Allowed presentation tokens

### `themeKey` (clay)

`blue`, `orange`, `cyan`, `green`, `purple`, `mint`, `yellow`, `pink`, `teal` (alias of `mint`), `peach`, `cream`, `beige`, `indigo`, `sky`, `red`, `white`

### `iconKey` (common Explore set)

Prefer the six above: `monitor`, `trophy`, `news`, `globe`, `bulb`, `mic`.  
Any name from the app icon set is accepted; unknown keys still render as a generic glyph via the alias/fallback path.

## Target

Tapping a section uses the same router as home banners (`src/features/catalog/openPublishedTarget.ts`).

| `targetKind` | `targetRef` | Opens |
|---|---|---|
| `catalog` | `course` | Computer Courses |
| `catalog` | `course,free` | Computer Courses, free filter |
| `catalog` | `course,paid` | Computer Courses, paid filter |
| `catalog` | `exam` | Competitive Exam |
| `catalog` | `news` | Daily News |
| `catalog` | `topic` | General Awareness |
| `catalog` | `fact` | Amazing Facts |
| `catalog` | `interview` | Interview Prep |
| `section` | `computer-courses` (or other known slug) | Same as that catalogue |
| `course` | course id | That course detail |
| `exam` | exam id | That exam detail |
| `news` | article id | That news article |
| `topic` | topic id | That awareness topic |
| `fact` | fact id | That fact |
| `interviewCategory` | category id | Interview question list |
| `interviewQuestion` | question id | That interview question |
| `liveClass` | live class id | Live room |
| `test` | test id | Test instructions |
| `lesson` | lesson id | Lesson player |

Also accepted as `targetRef` prefixes: `course:…`, `exam:…`, `news-category:…`, `awareness-topic:…`, `interview-category:…`, and `catalog(course,paid)` style wrappers.

Omit `targetKind` only when the tile must not navigate. Invalid or unpublished targets must not be publishable from admin.

## Admin panel module

Build `/admin/explore-sections` so staff can:

1. List sections with title, category, target, pricing filter, sort order, home visibility, lifecycle, and schedule.
2. Create from a template of the six paths above (pre-filled icon, clay, target).
3. Edit title, subtitle, description, highlights, badge, category, icon, theme, image, keywords.
4. Pick a validated target from the Target table — never a free-typed React Navigation route name.
5. Set `pricingFilter`, `homeVisible`, `sortOrder`, audience, schedule, and minimum app version.
6. Preview the Home tile and the Explore directory card.
7. Publish / unpublish / archive. Rename without changing `id`.
8. Reorder with drag-and-drop; persist `sortOrder` and return that order on `/home`.
9. Audit every create, rename, reorder, target change, publish, and hide.

### Publish rules for learner API

- Only `lifecycle: "published"` sections inside their schedule window.
- Sort by `sortOrder` ascending (or explicit admin order) before returning.
- Drop rows with missing `id`, missing `title`, or an invalid target.
- `homeVisible: false` may still appear on a full Explore directory endpoint later; until then, prefer not returning them on `/home` if Home is the only consumer.
- Changing the title must not change `id`, enrollments, bookmarks, notifications, or banner targets that point at this section.

## What Explore sections do **not** create

| Explore tile | Actual content still required | Handover |
|---|---|---|
| Computer Courses | `GET /courses` (+ lessons) | [01-computer-courses.md](./01-computer-courses.md) |
| Competitive Exam | `GET /exams`, `GET /tests` | [02-competitive-exams.md](./02-competitive-exams.md) |
| News | `GET /news/categories`, `GET /news` | [03-daily-news.md](./03-daily-news.md) |
| General Awareness | Awareness topics + entries | [04-general-awareness.md](./04-general-awareness.md) (learner API), [14-admin-general-awareness.md](./14-admin-general-awareness.md) (admin CMS) |
| Amazing Facts | `GET /facts/categories`, `GET /facts` | [05-amazing-facts.md](./05-amazing-facts.md) (learner API), [15-admin-amazing-facts.md](./15-admin-amazing-facts.md) (admin CMS) |
| Interview Prep | `GET /interview/categories`, questions | [06-interview-prep.md](./06-interview-prep.md) (learner API), [16-admin-interview-prep.md](./16-admin-interview-prep.md) (admin CMS) |

Home banners use the same target vocabulary: [07-home-banners.md](./07-home-banners.md).

## Acceptance checklist

- [ ] Admin can create the six seed sections with the stable ids in the table above.
- [ ] `GET /home` returns those six (or the current published set) in admin order under `sections`.
- [ ] Each section opens the correct catalogue when `targetKind` / `targetRef` are set as above.
- [ ] Renaming “Computer Courses” does not change `id` `computer-courses` or break banner/deep-link targets.
- [ ] Reordering in admin changes the order of `sections` on `/home`.
- [ ] Unpublished, expired, or invalid-target sections are absent from the learner payload.
- [ ] Publishing only an Explore section still leaves the linked catalogue empty until handovers 01–06 content is published.
- [ ] Every publish, reorder, rename, hide, and target change is audited.
