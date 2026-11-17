# Handover 10 — Admin: course pricing & simple arrange

Admin-web spec for Computer Courses: set a **rupee price** for paid courses, show that **amount** (not the word “Paid”) in the learner app, switch **Free ↔ Paid** in one control, and keep **course / semester order** easy.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff edit courses in the admin panel; the learner API exposes published values on `GET /courses` and course detail.

Related: [01-computer-courses](./01-computer-courses.md) (catalogue), [09-explore-sections](./09-explore-sections.md) (Explore free/paid filters), full portal: `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §12 / §19.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Mark a course free or paid | One **Access** switch: Free / Paid |
| Set what learners pay | When Paid: one **Price (₹)** field in whole rupees |
| See price in the app | Lists and detail show `₹499` (or Free), never a bare “PAID” chip when a price exists |
| Arrange courses | Drag list or ↑↓; save `sortOrder` |
| Arrange semesters | Inside a semester course: drag Semesters 1…N; save `sortOrder` |

Do not bury price under a separate “Products” screen for day-to-day use. Link a product in the background if checkout needs it; the editor still sees **Free / Paid + ₹**.

---

## Admin screen: Courses

Build `/admin/courses` (list) and `/admin/courses/:id` (edit).

### List columns (minimal)

| Column | Shows |
|---|---|
| Order | Drag handle / sort index |
| Title | Course title |
| Type | Standard / Semester track |
| Access | **Free** or **₹{amount}** (never only “Paid”) |
| Status | Draft / Published / Archived |
| Actions | Edit, publish, archive |

Filter chips: All · Free · Paid · Semester · Standard.  
Search by title / code. Default sort = admin `sortOrder` ascending.

### Edit form — Access & price (required UX)

```
Access:  ( • Free )  ( ○ Paid )

When Paid:
  Price (₹)     [  499  ]     ← whole rupees only
  Preview       ₹499
```

Rules:

1. **Free** → clear price; learner API returns `commercialMode: "free"` and no sellable amount.
2. **Paid** → price required; integer rupees **≥ 1**; reject `0` and decimals in the admin UI.
3. Store money as API `Money`: `{ "amountMinor": 49900, "currency": "INR" }` (rupees × 100 = paise).
4. Admin always **types rupees**; conversion to `amountMinor` is server-side (or a thin client helper). Never ask staff for paise.
5. Switching Paid → Free clears price after a confirm: “Remove ₹499 and make this course free?”
6. Switching Free → Paid focuses the Price field and blocks Save until a valid amount is entered.
7. List + edit header preview: Free → badge `FREE`; Paid → badge/`₹499` (formatted with Indian grouping when ≥ 1000, e.g. `₹1,499`).

Optional advanced (collapsed): store product ID, MRP, sale window. Not required for first publish.

### Other course fields (keep short)

| Field | Notes |
|---|---|
| `id` / code | Stable; never change after first publish |
| Title, subtitle, description | Learner-facing |
| Cover image | HTTPS URL |
| Delivery type | `standard` or `semester_certification` |
| `sortOrder` | Catalogue order |
| Lifecycle | draft → published → archived |

---

## Learner display contract

Replace “PAID” with the **amount** wherever a paid course is shown without purchase.

| Surface | Free | Paid (not purchased) | Purchased |
|---|---|---|---|
| Course card / catalogue | `FREE` | `₹499` | `PURCHASED` or hide price |
| Course detail badge | `FREE` | `₹499` | `PURCHASED` |
| Explore “paid” filter | Still filters `commercialMode === paid` / pricing `paid` | Cards inside still show `₹…` | — |

API shape the app should receive on course list/detail:

```json
{
  "id": "course-ms-office",
  "title": "MS Office Essentials",
  "commercialMode": "paid",
  "price": { "amountMinor": 49900, "currency": "INR" },
  "sortOrder": 20,
  "deliveryType": "standard",
  "lifecycle": "published"
}
```

Free example:

```json
{
  "id": "course-tally-prime-basics",
  "title": "Tally Prime Basics",
  "commercialMode": "free",
  "price": null,
  "sortOrder": 10,
  "deliveryType": "standard",
  "lifecycle": "published"
}
```

Mapping notes for the learner app (when implementing):

- `pricing`: `commercialMode === "free"` → `free`, else `paid`.
- Prefer formatting `price.amountMinor / 100` as `₹…` on badges/cards instead of the literal label `PAID`.
- Catalogue filters `free` / `paid` stay as they are (`pricingFilter` / query `pricing`); only the **label** on paid items becomes the amount.

Publish rules:

- Paid + missing/invalid `price` → **cannot publish**.
- Free + non-null price → reject or ignore price; treat as free.
- Currency for REDI v1 is **INR only**.

---

## Simple course arrange

Staff should not edit raw sort numbers unless they want to.

### Recommended UX

1. Courses list opens in **Arrange** mode (or a clear “Arrange courses” button).
2. Drag-and-drop rows; optional ↑ / ↓ for accessibility.
3. On drop, persist contiguous `sortOrder` (`10, 20, 30…` or `1, 2, 3…`).
4. `GET /courses` (and Home/Explore course lists that use API order) return this order.
5. Renaming a course must **not** change `id` or `sortOrder`.

Admin API (illustrative):

```http
PATCH /admin/courses/reorder
Content-Type: application/json

{ "orderedIds": ["course-a", "course-b", "course-c"] }
```

Audit: actor, before/after order, request id.

---

## Simple semester arrange

Only for `deliveryType: "semester_certification"`.

### Recommended UX

Inside course edit → **Semesters** tab:

```
Semesters for: Tally Certification
[drag] 1  Foundation          Edit · Lessons
[drag] 2  Intermediate        Edit · Lessons
[drag] 3  Advanced            Edit · Lessons
[+ Add semester]
```

Rules:

1. Order = learning sequence. Semester 1 unlocks first; later ones stay locked until admin approval flow unlocks them (see existing semester statuses).
2. Drag reorder updates `sortOrder` and displayed index (1…N). Do **not** renumber stable `semesterId`s.
3. Adding a semester appends at the end; staff can drag it up if needed.
4. Deleting/archiving a semester that has progress is blocked; archive instead.
5. Lessons / tests / projects live **inside** a semester; reorder those on the semester detail page the same way (drag list).

Admin API (illustrative):

```http
PATCH /admin/courses/{courseId}/semesters/reorder
Content-Type: application/json

{ "orderedIds": ["sem-1", "sem-2", "sem-3"] }
```

Learner outline must receive semesters already sorted; the app displays the array order.

---

## Admin module checklist

Build so staff can:

1. Create a course and pick **Standard** or **Semester track**.
2. Toggle **Free / Paid**; enter **Price (₹)** only when Paid.
3. See list/preview as **FREE** or **₹amount**, never a price-less “Paid” for published paid courses.
4. Save; API stores `commercialMode` + `price.amountMinor` (INR).
5. Publish only when Paid has a valid rupee amount.
6. Drag-reorder courses on the list; persist `sortOrder`.
7. On semester courses, drag-reorder semesters; persist order without changing IDs.
8. Audit create, price change, free↔paid switch, publish, and both reorders.

---

## Acceptance checklist

- [ ] Admin can switch a course Free ↔ Paid in one control.
- [ ] Paid requires a whole-rupee price; stored as `amountMinor` + `INR`.
- [ ] Course list and edit preview show `₹499` (example), not the word “Paid” alone.
- [ ] Learner catalogue/detail show `FREE` or `₹…` / `PURCHASED` per the display table.
- [ ] Free courses never require or show a price.
- [ ] Drag (or ↑↓) reorder of courses changes order on `GET /courses`.
- [ ] Drag reorder of semesters changes outline order without changing semester IDs.
- [ ] Publish blocked for Paid without price.
- [ ] Free→Paid and Paid→Free transitions and price edits are audited.

---

## Out of scope for this handover

- Coupon rules, tax invoices, multi-currency.
- Play Billing / App Store product SKU mapping UI (may sit in a collapsed “Store” section later).
- Semester **approval** queue (separate academic review module).
- Explore section tiles (handover 09) — those only filter free/paid catalogues; course prices are set here.
