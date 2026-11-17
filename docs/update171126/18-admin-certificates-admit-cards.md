# Handover 18 — Admin: Certificates & Admit Cards

Admin-web spec so staff can **generate, review, issue, revoke, supersede, and verify** official learner documents — matching what the learner app already renders on Profile (`AdmitCardBanner`), `DocumentList`, `AdmitCard`, `Certificate`, and `ProtectedViewer`.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage templates and issuance in admin; learners only read **their own** issued rows from `GET /me/documents` and `GET /me/documents/{id}`, and verify via `GET /documents/verify/{token}`.

Related: learner flow [`docs/flows/12-notifications-documents.md`](../flows/12-notifications-documents.md), full portal `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §18, app type `IssuedDocument` in `src/core/types.ts`, screens `src/screens/documents/*`, Profile entry points in `src/screens/profile/ProfileScreen.tsx`. Notifications that deep-link a document use `ContentRef` kind `document` + document id ([17-admin-notifications](./17-admin-notifications.md)).

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Issue a semester exam hall ticket | Pick learner + exam window → fill roll / venue / times → generate PDF → approve → **issue** |
| Issue a course-completion certificate | Confirm eligibility (course / semesters / tests) → generate → approve → **issue** |
| Fix a wrong hall ticket after issue | **Reissue** (new document); old row becomes `superseded` — never overwrite the PDF |
| Cancel a leaked / fraud case | **Revoke** with reason; learner UI shows unavailable / revoked |
| Check a QR / serial | Lookup by serial or verification token; public verify returns minimum facts only |
| Bulk for a batch / exam | Dry-run eligibility → generate → review queue → issue |

The learner app **cannot** manufacture, approve, or “verify locally” a document. Only `status: "issued"` opens the full Admit Card / Certificate screens. Everything else stays list-only (“Not issued” / Revoked / …).

---

## Document model (what the app understands)

```
DocumentTemplate (versioned)          ← admin layout + variables + seal/QR
  └─ IssuedDocument[]                 ← one row per learner document
        ├─ kind                       ← admit_card | certificate (| receipt later)
        ├─ status                     ← lifecycle below
        ├─ serial                     ← human-readable CERT / ADMIT id
        ├─ details{}                  ← typed display fields the screens read
        ├─ resourceId                 ← protected PDF for Open / Save
        ├─ verificationToken          ← opaque token for QR / verify API
        └─ issuedAt / expiresAt
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Template** | Layout, variables, seal, signature, QR placement | Admin only (PDF rendering) |
| **Issued document** | Authoritative record for one learner | Profile banner, Document list, Admit/Cert screens |
| **Protected PDF** | Official downloadable file | `ProtectedViewer` / Save PDF via authorize-download |
| **Verification** | Public / in-app validity check | QR tap → `GET /documents/verify/{token}` |

### Statuses the app already accepts

Keep these exact strings (from `IssuedDocument` in `src/core/types.ts`):

| Status | Learner behaviour |
|---|---|
| `not_issued` | Listed if returned; not tappable as full card |
| `generation_pending` / `generated` / `approval_pending` / `generation_failed` | Admin pipeline; treat as “Not issued” in list label |
| `issued` | Full Admit Card / Certificate UI; Profile banner; verified stamp when valid |
| `revoked` | List shows Revoked; detail screen error if opened |
| `superseded` | Replaced by a newer issue; list label Superseded |
| `expired` | List shows Expired (admit cards / time-bound certs) |

Compatibility note from product rules: at minimum keep `not_issued`, `issued`, `revoked`, `superseded`, `expired` stable forever.

### Lifecycle (admin commands — not free-form status patch)

```text
not_eligible → eligible → generation_pending → generated → approval_pending → issued
                                 └→ generation_failed
issued → superseded   (reissue)
issued → revoked
issued → expired      (only when expiresAt is set and policy allows)
```

- **Generate ≠ issue.** Officers review the PDF / snapshot before issue unless an approved auto-issue policy is on.
- Reissue creates a **new** document id + PDF; previous becomes `superseded`.
- Never hard-delete an issued PDF referenced by a learner row.

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/documents` | Unified queue (filters: kind, status, course, batch, exam window) |
| `/admin/documents/certificates` | Certificate list (shortcut) |
| `/admin/documents/admit-cards` | Admit card list (shortcut) |
| `/admin/documents/new` | Start generate flow (kind + learner / batch) |
| `/admin/documents/:id` | Detail: snapshot, PDF preview, issue / revoke / reissue, audit |
| `/admin/documents/templates` | Template list |
| `/admin/documents/templates/new`, `/admin/documents/templates/:id` | Create / new version of a template |
| `/admin/documents/verify` | Staff lookup by serial or token |
| `/admin/learners/:id/documents` | Learner profile → Documents tab |

Also allow **Issue certificate** from course / semester completion views and **Issue admit cards** from an exam / test window — both deep-link into this module with fields pre-filled.

---

## 1. Templates

Versioned templates for `admit_card` and `certificate`.

### Template fields

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Stable template id |
| `kind` | yes | `admit_card` \| `certificate` |
| `name` | yes | Staff label |
| `version` | yes | Immutable after publish; edit = new version |
| `locale` | no | Default `en` |
| Layout | yes | Page size, orientation, background, logo/seal, typography |
| Signature blocks | yes | Signatory name + role placeholders |
| QR position | yes | Must render verification QR from opaque token/URL |
| Variables | yes | Typed placeholders (see below) |
| Applicability | no | Course ids, batch ids, exam window, effective dates |
| Lifecycle | yes | Draft → Approved / Published → Retired |

### Typed variables the app / PDF need

**Shared:** `learnerName`, `course`, `serial`, `issuedAt`, `instituteName`

**Admit card:** `roll`, `semester`, `examDate`, `examAt`, `examEndAt`, `reporting`, `period`, `venue`, `academicYear`, `instructions` (newline-separated lines)

**Certificate:** `score`, `grade`, `signatory`, `signatoryRole`, `certificateId` (usually = serial)

Published templates are **immutable**. Issued documents keep `templateVersion` + a frozen field snapshot so later template edits never change old PDFs.

### List columns (templates)

| Column | Shows |
|---|---|
| Name | Staff label |
| Kind | Certificate / Admit card |
| Version | e.g. `v3` |
| Status | Draft / Approved / Retired |
| Used by | Count of issued docs on this version |
| Actions | Preview, new version, retire |

---

## 2. Certificates

### Eligibility (server-side)

Typical gates (configurable per course / product):

- Active enrollment + entitlement
- Required semesters `approved` / course complete
- Required projects accepted
- Required tests passed and results **published**
- Profile name present (shown on the certificate)
- No blocking academic / financial hold (where policy allows)
- Academic / Document Officer approval

### Create / issue form (single)

```
Certificate
  Learner *            [ search by name / phone / id ]
  Course *             [ course picker ]
  Template *           [ approved certificate template ]
  Title *              [ Certificate of Completion — Tally Prime ]
  Score                [ 92% ]
  Grade                [ A ]
  Signatory            [ Dr. … ]     ← defaults from template
  Signatory role       [ Director ]
  Serial               [ auto CERT-2026-… ]  ← collision-resistant
  Expires at           [ optional ]
  Notify learner       [ ✓ inbox + optional push ]
```

### List columns

| Column | Shows |
|---|---|
| Learner | Name + masked contact |
| Title | Document title |
| Course | Course title / id |
| Serial | Human serial |
| Status | Pipeline / issued / revoked / … |
| Issued at | Local timezone |
| Actions | Open, issue, revoke, reissue, verify link |

### What the Certificate screen reads

From `IssuedDocument` / `details`:

| Field | App use |
|---|---|
| `learnerName` | Hero name (“presented to …”) |
| `details.course` or `title` | Course line under the name |
| `details.score` | Optional SCORE chip |
| `details.grade` | Optional GRADE chip |
| `details.certificateId` or `serial` | `CERT ID · …` |
| `details.signatory` | Left signature (default “Authorized Signatory”) |
| `details.signatoryRole` | Role under signature (default “RACI”) |
| `issuedAt` | Date of Issue |
| `resourceId` | Save / Open official PDF |
| `verificationToken` | In-app verify |
| `verified` | “ISSUED VIA RACI ADMIN PANEL · VERIFIED” line |
| `shareForbidden` | App disables share/export/print (default `true`) |

Semester outline “View certificate” opens `DocumentList` with `kind: 'certificate'`. Profile shows issued count.

---

## 3. Admit cards

### Eligibility

- Learner enrolled / assigned to the exam window or course semester exam
- Roll / registration number assigned
- Exam date + venue (or online instructions) configured
- Identity / photo policy satisfied if required
- No exam ban / hold

### Create / issue form (single or bulk)

```
Admit card
  Learner(s) *         [ one or batch / exam roster ]
  Course *             [ … ]
  Semester             [ Semester 2 · Mid-term ]
  Academic year        [ 2025–26 ]
  Roll number *        [ RACI-2026-0142 ]
  Exam date (display)  [ 12 Mar 2026 ]
  Exam start (ISO) *   [ 2026-03-12T04:30:00Z ]  ← powers calendar + status chip
  Exam end (ISO)       [ 2026-03-12T06:30:00Z ]
  Reporting time       [ 09:30 AM ]
  Exam timing          [ 10:00 AM – 12:00 PM ]
  Venue *              [ Block A · Hall 2 ]
  Instructions         [ multiline; one rule per line ]
  Template *           [ approved admit template ]
  Serial               [ auto ADMIT-… ]
  Notify learner       [ ✓ ]
```

### List columns

| Column | Shows |
|---|---|
| Learner | Name |
| Course / semester | Short labels |
| Exam date | Display date |
| Roll | Roll number |
| Serial | Admit id |
| Status | … |
| Actions | Open, issue, revoke, reissue |

### What the Admit Card screen reads

| Field | App use |
|---|---|
| `learnerName` | Candidate Name + avatar initial |
| `details.roll` | Roll Number |
| `details.course` | Course row + header subtitle |
| `details.semester` | Semester row + header |
| `details.examDate` | Exam Date row + list meta |
| `details.reporting` | Reporting Time |
| `details.period` | Exam Timing |
| `details.venue` | Venue |
| `details.academicYear` | “SEMESTER EXAM ADMIT CARD · {year}” |
| `details.admitCardId` or `serial` or `roll` | Banner / verify id |
| `details.examAt` | Upcoming / today / past chip + Google Calendar |
| `details.examEndAt` | Calendar end (default +2h if missing) |
| `details.instructions` | Newline-split instruction list |
| `issuedAt` | “Issued by RACI Admin Panel · {date}” |
| `resourceId` | Save / Open PDF |
| `verificationToken` | QR / verify taps |
| `verified` | “ISSUED BY ADMIN · VERIFIED” stamp |

Profile banner picks the learner’s issued admit card and shows `semester · examDate · venue`.

**After issue:** venue / time / roll changes require **reissue** + learner notification — do not mutate the issued snapshot silently.

---

## 4. Learner API payloads (contract the app expects)

Staff never call these; the shared API must expose them after issue.

### List — `GET /me/documents`

Optional filter: client may request by kind; today the HTTP client loads all and filters `admit_card` / `certificate`.

Auth required. Guests have no documents.

Minimal item shape (list can omit long instructions):

```json
{
  "id": "doc_cert_tally_001",
  "documentType": "certificate",
  "status": "issued",
  "serial": "CERT-2026-00421",
  "title": "Certificate of Completion — Tally Prime",
  "courseId": "course-tally-prime",
  "resourceId": "res_pdf_cert_tally_001",
  "issuedAt": "2026-03-01T10:00:00Z",
  "expiresAt": null,
  "verificationToken": "vt_opaque_token",
  "shareForbidden": true,
  "details": {
    "course": "Tally Prime — Complete",
    "score": "92%",
    "grade": "A",
    "certificateId": "CERT-2026-00421",
    "signatory": "Authorized Signatory",
    "signatoryRole": "RACI"
  }
}
```

Admit card example:

```json
{
  "id": "doc_admit_sem2_0142",
  "documentType": "admit_card",
  "status": "issued",
  "serial": "ADMIT-2026-0142",
  "title": "Semester 2 Exam Admit Card",
  "courseId": "course-tally-prime",
  "resourceId": "res_pdf_admit_0142",
  "issuedAt": "2026-03-05T08:00:00Z",
  "expiresAt": "2026-03-12T18:30:00Z",
  "verificationToken": "vt_admit_0142",
  "shareForbidden": true,
  "details": {
    "course": "Tally Prime — Complete",
    "semester": "Semester 2 · Mid-term",
    "roll": "RACI-2026-0142",
    "admitCardId": "ADMIT-2026-0142",
    "examDate": "12 Mar 2026",
    "examAt": "2026-03-12T04:30:00Z",
    "examEndAt": "2026-03-12T06:30:00Z",
    "reporting": "09:30 AM",
    "period": "10:00 AM – 12:00 PM",
    "venue": "Block A · Hall 2",
    "academicYear": "2025–26",
    "instructions": "Carry a valid photo ID.\nNo electronic devices in the hall.\nReport 30 minutes before start."
  }
}
```

### Detail — `GET /me/documents/{id}`

Same shape as a list item; include full `details` (especially `instructions`). Prefer returning `learnerName` on the document or let the client attach the profile name (current HTTP mapper uses profile name).

Rules:

1. Only the owning learner may fetch the row (403/404 otherwise).
2. `status !== "issued"` may still appear in the list; detail screens treat non-issued / wrong kind as unavailable.
3. `shareForbidden` defaults to `true`. PDFs go through authorize-download, not public CDN URLs.
4. Map `serial` → `details.admitCardId` / `details.certificateId` when those keys are omitted.
5. Map a human course title into `details.course` (do not leave only an opaque `courseId` if the UI should show a name).

### Verify — `GET /documents/verify/{token}`

```json
{
  "valid": true,
  "status": "issued",
  "message": "Document is valid.",
  "title": "Certificate of Completion — Tally Prime",
  "serial": "CERT-2026-00421",
  "issuer": "Ranjan Educational Institute",
  "identity": { "displayName": "A. Learner" }
}
```

| Rule | Detail |
|---|---|
| Token | Opaque; never encode phone, email, scores, or private file URLs in the QR |
| `valid` | `true` only when current status is `issued` (and not past `expiresAt` if applicable) |
| Privacy | No phone, email, address, scores, or PDF links |
| Revoked / not issued | `valid: false`; never show a verified badge in the app |

QR payload = official verification URL/token from the issued record — **not** a fabricated marketing link.

---

## 5. PDF generation & protected download

1. Render PDF from approved template + frozen snapshot (worker job).
2. Store content hash, template version, and `resourceId`.
3. On failure → `generation_failed` with retry; surface on admin dashboard.
4. Learner “Open official PDF” / “Save protected PDF” uses `POST`/`GET` authorize-download for that `resourceId` (same pattern as lesson PDFs).
5. App copy: issued documents stay inside the account; sharing / printing from the card UI is disabled when `shareForbidden` is true.

---

## 6. Preview (required)

On document detail / before issue:

1. **List card** — title, course, status, exam date or score/grade.
2. **Admit card mock** — institute header, roll, venue, times, QR placeholder, instructions.
3. **Certificate mock** — name, course, score/grade chips, signatory, cert id, verified line.
4. **PDF preview** — server-rendered page(s) with real or sample data.

Preview must use the **current snapshot** about to be issued.

---

## 7. Issue, revoke, reissue, notify

| Action | Behaviour |
|---|---|
| **Issue** | Set `issued` + `issuedAt`; attach `verificationToken`; create learner-visible row; optional notification (`target.kind: "document"`, `target.id`) |
| **Revoke** | Reason (standardized) + internal note; `status: revoked`; invalidate verify; notify learner |
| **Reissue** | New document id + serial/PDF; old → `superseded`; notify with new document target |
| **Expire** | Job or rule when `expiresAt` passes; verify returns invalid |

Bulk issue: dry-run report (eligible / blocked reasons) → confirm count → background job with failure CSV.

Audit every generate, approve, issue, revoke, reissue, template publish, and verification lookup by staff.

---

## 8. Admin API shape (illustrative)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/documents` | List / filter queue |
| `POST` | `/admin/documents/generate` | Enqueue generation (single or bulk) |
| `GET` | `/admin/documents/:id` | Detail + snapshot + PDF url (staff) |
| `POST` | `/admin/documents/:id/issue` | Approve + issue |
| `POST` | `/admin/documents/:id/revoke` | Revoke with reason |
| `POST` | `/admin/documents/:id/reissue` | Supersede + new document |
| `GET` | `/admin/documents/verify` | Staff lookup (`serial` or `token`) |
| `GET/POST` | `/admin/document-templates` | List / create template |
| `POST` | `/admin/document-templates/:id/versions` | New immutable version |
| `POST` | `/admin/document-templates/:id/publish` | Approve template version |

Generate body example:

```json
{
  "kind": "admit_card",
  "templateId": "tpl-admit-sem-exam",
  "templateVersion": 3,
  "learnerId": "lrn_0142",
  "courseId": "course-tally-prime",
  "title": "Semester 2 Exam Admit Card",
  "details": {
    "roll": "RACI-2026-0142",
    "semester": "Semester 2 · Mid-term",
    "examDate": "12 Mar 2026",
    "examAt": "2026-03-12T04:30:00Z",
    "examEndAt": "2026-03-12T06:30:00Z",
    "reporting": "09:30 AM",
    "period": "10:00 AM – 12:00 PM",
    "venue": "Block A · Hall 2",
    "academicYear": "2025–26",
    "instructions": "Carry a valid photo ID.\nNo electronic devices in the hall."
  },
  "notify": true
}
```

Learner-side (already expected by the app):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me/documents` | Own documents |
| `GET` | `/me/documents/{id}` | One document |
| `GET` | `/documents/verify/{token}` | Public / in-app verification |
| authorize-download | existing resource flow | Official PDF |

---

## 9. Permissions

| Action | Permission (illustrative) |
|---|---|
| View documents / verify lookup | `documents.view` |
| Edit templates (draft) | `documents.templates` |
| Publish template version | `documents.templates_publish` |
| Generate | `documents.generate` |
| Issue | `documents.issue` |
| Revoke / reissue | `documents.revoke` |
| Bulk generate / issue | `documents.bulk` |

Separation of duties: template publisher and high-volume issuer should not be the same person when dual-control is configured. Revocations always require a reason.

---

## Acceptance checklist

- [ ] Staff can open `/admin/documents`, filter by kind/status, and open a document detail with PDF preview.
- [ ] An approved **certificate** template can generate → approve → issue; learner sees it under Certificates and can open `Certificate` only when `issued`.
- [ ] An approved **admit card** template can generate → issue; Profile banner and Admit Card screen show roll, venue, times, instructions, and exam status from `examAt`.
- [ ] `GET /me/documents` returns `details` keys the screens read (`course`, `score`/`grade` or exam fields, serial ids).
- [ ] Official PDF opens only via authorize-download (`resourceId`); no permanent public PDF URL.
- [ ] QR / verify uses opaque `verificationToken`; revoked / superseded / expired never return `valid: true`.
- [ ] Reissue creates a new id and marks the old row `superseded` without overwriting the original PDF.
- [ ] Revoke hides the full card UI and updates verification.
- [ ] Optional notification on issue uses `target: { "kind": "document", "id": "<documentId>" }`.
- [ ] Every generate, issue, revoke, reissue, and template publish is audited.

---

## Out of scope (phase 1)

- Learner-side document editing or self-service “request certificate” without staff/eligibility rules.
- Public marketing “verify” pages that invent validity without the issued record.
- Receipt kind UI polish (API may store `receipt`; app focuses on admit card + certificate).
- Email/SMS delivery of PDFs as the primary channel (inbox deep-link + in-app PDF first).
- Auto-sharing to social networks (app keeps `shareForbidden` by default).
