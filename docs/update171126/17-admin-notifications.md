# Handover 17 — Admin: Notifications (broadcast to installed app users)

Admin-web spec so staff can **compose, schedule, approve, and send** inbox + Android push notifications to learners who have installed the app — matching what the learner app already renders on `Notifications` (inbox) and Notification Settings.

Learner base: `https://redi-api-production.up.railway.app/api`  
The app never calls `/admin/*`. Staff manage campaigns in admin; learners read their own rows from `GET /me/notifications` (and mark read / clear). Push wake-up uses FCM when the Android build has Firebase configured.

Related: technical contract [`docs/notification-system.md`](../notification-system.md), full portal `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` §17, app types `NotificationItem` / `ContentRef` in `src/core/types.ts`, screens `src/screens/notifications/*` and `NotificationSettingsScreen`. Deep-link targets reuse stable content ids from News, Awareness, Facts, Interview, Courses, Exams, Live.

---

## Goal (keep it simple)

| Staff need | Admin behaviour |
|---|---|
| Tell **everyone with the app** about an update | Audience = **All eligible learners** → compose → preview count → approve → send |
| Notify one learner or a small list | Audience = learner IDs (search / paste) |
| Notify a course or batch | Audience = course / batch (resolved to enrolled learners) |
| Open a specific screen when tapped | Set **target** (`ContentRef`: kind + id) + optional action label |
| Send later | Schedule `scheduleAt` (timezone shown in local preview) |
| Stop a bad send | Cancel only undelivered work; never rewrite already-sent inbox rows |
| See what happened | Campaign metrics: recipients, FCM accepted, invalid tokens, opened, read |

**Primary use case for this handover:** broadcast a campaign so every learner who has installed the app and has an active account (and, for push, a registered Android device) receives the message in the **in-app inbox**, with optional **system tray push** on Android.

Explore / content modules must **not** embed their own push composers. They deep-link into this module with a pre-filled target (e.g. `news` + article id).

---

## Delivery model (what the app understands)

```
Admin campaign (draft → approved → scheduled/sending → sent)
  └─ One inbox row per eligible learner     ← GET /me/notifications (source of truth)
  └─ Optional FCM data message per device   ← Android tray; tap opens target
```

| Layer | Purpose | Learner surfaces |
|---|---|---|
| **Campaign** | Admin draft / schedule / metrics | Admin only |
| **Inbox item** | Durable notification the learner sees | `NotificationsScreen` |
| **Push delivery** | Wake Android / show tray | OS notification → open app at `target` |
| **Device registration** | Links FID to learner + category prefs | Settings → Notifications |

Rules the app already assumes:

1. **Inbox is authoritative.** Push can be delayed, duplicated, or missing; the inbox must still list the message.
2. Categories the inbox filters: `classes`, `tests`, `news`, `offers` (+ `system` for mandatory messages — not user-disableable).
3. Tap → mark read → navigate using `target.kind` + `target.id` after access check. Guests hitting a protected target store a pending destination and see Login.
4. Local learning / live-class reminders on the device are **not** admin campaigns; do not confuse them with this module.

---

## Admin screens to build

| Route | Purpose |
|---|---|
| `/admin/notifications` | Campaign list (default landing) |
| `/admin/notifications/new` | Composer (create draft) |
| `/admin/notifications/:id` | Edit draft / review / metrics / cancel |
| `/admin/notifications/:id/preview` | Resolved audience + inbox + Android tray preview |
| `/admin/notifications/templates` *(optional phase 2)* | Versioned templates |

Also allow **Send notification** shortcuts from learner profile (single user) and from content editors (pre-fill `target` only — still uses this module).

---

## 1. Campaign list

### List columns

| Column | Shows |
|---|---|
| Internal name | Staff label (not shown in app) |
| Title | Learner-visible title |
| Category | `classes` / `tests` / `news` / `offers` / `system` |
| Audience | All / course / batch / segment / N learners |
| Channels | Inbox · Push |
| Status | draft · in_review · approved · scheduled · sending · sent · cancelled · failed/partial |
| Schedule | Immediate or local `scheduleAt` |
| Recipients | Resolved count (after prepare) |
| Created by | Actor |

Filters: status, category, date range, creator. Default sort: newest first.

### Row actions

| Status | Allowed actions |
|---|---|
| draft | Edit, delete, submit for review / publish (per permission) |
| in_review / approved | Preview, schedule/send, cancel |
| scheduled | Reschedule (if not preparing), cancel |
| sending | Pause (if supported), cancel remaining |
| sent / failed/partial | View metrics only (no rewrite of sent body) |
| cancelled | View only |

---

## 2. Composer fields

| Field | Required | Notes |
|---|---|---|
| Internal campaign name | yes | Admin-only; searchable |
| Title | yes | Max ~80 chars; shown in inbox + tray |
| Body | yes | Max ~240 chars for tray; inbox can show full body |
| Category | yes | `classes` \| `tests` \| `news` \| `offers` \| `system` |
| Priority | yes | `normal` \| `high` (maps to FCM Android priority) |
| Action label | no | e.g. “Open class”, “Read article” |
| Target | recommended | `{ kind, id }` — see target table below |
| Audience | yes | See audience section |
| Channels | yes | Always create **inbox** rows for eligible learners; **push** optional (default on for Android FIDs) |
| Schedule | no | Empty = send on publish; else UTC instant + show Asia/Kolkata preview |
| Expiry | no | After `expiresAt`, omit from inbox; stop late push |
| Locale | no | Phase 1: single locale OK; do not claim HI if only EN is stored |
| Deduplication key | no | Prevents accidental double-broadcast of same campaign purpose |

### Categories ↔ learner toggles

| Category | Learner can disable push? | Typical use |
|---|---|---|
| `classes` | yes (`notifClasses`) | Live class timing, cancellations |
| `tests` | yes (`notifTests`) | Result published, test window |
| `news` | yes (`notifNews`) | Daily news / content updates |
| `offers` | yes (`notifOffers`) | Promotions, paid unlocks |
| `system` | **no** | Security, account, payment, mandatory service |

For non-`system` campaigns: exclude learners who opted out of that category from **push**. Still create the **inbox** row unless product policy says otherwise for pure promotional `offers` (recommend: inbox yes, push respect opt-out).

### Valid targets (`ContentRef`)

App accepts these `kind` values (unknown kinds are ignored on open):

| `kind` | Opens | Stable id source |
|---|---|---|
| `course` | Course detail | Course id |
| `lesson` | Lesson player | Lesson id |
| `exam` | Exam detail | Exam id |
| `test` | Test instructions / list | Test id |
| `news` | News article | Article id |
| `topic` | Awareness topic detail | Topic id |
| `fact` | Fact detail | Fact id |
| `interviewQuestion` | Interview question | Question id |
| `interviewCategory` | Interview category list | Category id |
| `liveClass` | Live schedule / room | Live class id |
| `document` | Admit card / certificate | Document id |
| `section` | Explore section | Section id |

Before publish: target must exist, be published (where applicable), and be authorized for the chosen audience. Show a blocking warning if the target is missing, archived, or unpaid-gated for most of the audience without unlock.

---

## 3. Audience (including “all installed users”)

| `audience.type` | Meaning | Resolve to |
|---|---|---|
| `all` | **Broadcast to all eligible authenticated learners** | Every active learner account; push only to those with a current Android FID |
| `learner_ids` | Explicit list | Those IDs only |
| `course` | Enrolled in course(s) | Current enrollments |
| `batch` | Batch membership | Current members |
| `segment` | Saved dynamic segment | Re-resolve at prepare time |

### “All users who installed the app”

Interpret as:

1. **Inbox:** all **active** authenticated learners (not deleted / suspended). Guests without an account do not get a durable inbox row unless a separate guest-device product is approved later.
2. **Push:** subset of (1) who have at least one **active** `push_devices` row (`provider: fcm`, Android) that has not been marked `UNREGISTERED`.
3. Before send, UI must show three numbers:
   - **Eligible learners** (inbox recipients)
   - **Push-reachable devices** (unique FIDs)
   - **Excluded** (opted out of category, suspended, no device, invalid token)

Sending with `audience.type: "all"` requires:

- Permission `notifications.send_bulk` (or equivalent)
- Re-auth / step-up confirmation
- Explicit reason text
- Confirmation that shows the three counts above
- Optional second approver for high-priority or `system` broadcasts

Never resolve “all” in the browser and POST tens of thousands of IDs. Resolve on the server at prepare time and fan out via a worker.

---

## 4. Publish workflow

```text
draft → in_review → approved → scheduled → preparing → sending → sent / partial / failed
                              └→ cancelled (only undelivered work)
```

| Step | Behaviour |
|---|---|
| Save draft | Validate lengths, category, target shape; do not resolve audience yet |
| Preview | Resolve count + sample inbox JSON + Android tray mock |
| Test send | Optional: send to current admin’s linked test learner / whitelist only |
| Publish / schedule | Create immutable recipient set; enqueue worker |
| Sending | Idempotent batches; rate-limited FCM; write delivery attempts |
| Cancel | Stop queued work; leave already-delivered inbox rows as-is |

Worker responsibilities:

1. Create one `inbox` / recipient row per learner (unique `(campaign_id, learner_id)`).
2. For each active device in the learner’s category prefs, send a **data-only** FCM message (see [`notification-system.md`](../notification-system.md)).
3. On permanent FCM invalid / `UNREGISTERED`, drop the device row.
4. Honor `expiresAt` and collapse key = campaign / notification id.

---

## 5. Learner payload (what admin publish must produce)

Each recipient’s inbox item must match `NotificationItem`:

```json
{
  "id": "ntf_01K...",
  "title": "New Daily News is live",
  "body": "Banking Current Affairs for today is ready to read.",
  "createdAt": "2026-11-17T06:30:00Z",
  "read": false,
  "category": "news",
  "source": "admin",
  "priority": "normal",
  "actionLabel": "Read article",
  "target": { "kind": "news", "id": "article_banking_today" }
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Stable inbox id; mark-read path |
| `title` / `body` | yes | List row + tray |
| `createdAt` | yes | Relative time (“2h ago”) |
| `read` | yes | Unread badge / home count |
| `category` | yes | Filter chips on `Notifications` |
| `source` | no | `admin` for this module |
| `priority` | no | Visual weight; FCM priority |
| `actionLabel` | no | CTA text when present |
| `target` | no | Deep link after tap |

Home unread count uses the same inbox (`unreadNotifications` on home composition).

---

## 6. Suggested admin API

Base under admin auth + MFA. Paths illustrative; keep consistent with the rest of `/admin/*`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/admin/notifications` | List campaigns |
| `POST` | `/admin/notifications` | Create draft |
| `GET/PATCH` | `/admin/notifications/:id` | Read / update draft |
| `GET` | `/admin/notifications/:id/preview` | Resolved counts + sample payload |
| `POST` | `/admin/notifications/:id/publish` | Approve + enqueue now or at `scheduleAt` |
| `POST` | `/admin/notifications/:id/cancel` | Cancel undelivered |
| `GET` | `/admin/notifications/:id/metrics` | Recipients, FCM, opens, reads |
| `POST` | `/admin/notifications/:id/test-send` | Whitelisted test only |

Create body (aligned with [`notification-system.md`](../notification-system.md)):

```json
{
  "internalName": "broadcast-news-17-nov",
  "title": "New Daily News is live",
  "body": "Banking Current Affairs for today is ready to read.",
  "category": "news",
  "priority": "normal",
  "audience": { "type": "all" },
  "target": { "kind": "news", "id": "article_banking_today" },
  "actionLabel": "Read article",
  "channels": ["inbox", "push"],
  "scheduleAt": null,
  "expiresAt": "2026-11-18T18:30:00Z"
}
```

Learner-side (already expected by the app; implement on API):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/me/notifications` | Inbox page (`cursor`, `category`) |
| `PATCH` | `/me/notifications/{id}` | `{ "read": true }` |
| `POST` | `/me/notifications/clear` | Mark all read / archive |
| `PUT` | `/me/push-devices/current` | Upsert Android FID + categories |
| `POST` | `/me/push-devices/unregister` | Remove FID on logout |

Audit every create, edit, approve, publish, cancel, and test-send (actor, timestamp, request id, before/after).

---

## 7. Permissions

| Action | Permission (illustrative) |
|---|---|
| View campaigns / metrics | `notifications.view` |
| Compose / edit draft / test-send | `notifications.compose` |
| Send to one learner or small list | `notifications.send_single` |
| Send to all / large segment / bulk | `notifications.send_bulk` |
| Approve high-priority or `system` | `notifications.approve` |
| Cancel scheduled / in-flight | `notifications.cancel` |

A composer must not approve their own high-priority or `system` broadcast when a second approver is configured.

---

## Acceptance checklist

- [ ] Staff can open `/admin/notifications`, create a draft with title, body, category, and optional target.
- [ ] Audience **All** shows eligible learner count, push-reachable device count, and exclusions before send.
- [ ] Publishing `audience.type: "all"` creates one inbox row per eligible learner; they appear on `GET /me/notifications`.
- [ ] Android devices with a registered FID receive a data-only FCM message; tap opens the correct `ContentRef` screen.
- [ ] Learners who disabled that category do not get **push** for non-`system` campaigns; `system` still delivers.
- [ ] Home unread badge increments; opening an item marks it read and navigates after access check.
- [ ] Scheduled campaigns send at `scheduleAt`; cancel stops only undelivered work.
- [ ] Invalid / missing targets cannot be published; expired items disappear from the learner inbox.
- [ ] Metrics show recipients, provider accepted, invalid tokens, opened, and read counts.
- [ ] Every create, approve, publish, cancel, and test-send is audited.

---

## Out of scope (phase 1)

- iOS APNs (Android FCM first; keep provider interface ready).
- Email / SMS channels in the same composer.
- Rich HTML bodies or large images in the tray payload (keep FCM data small and non-sensitive).
- Auto-translate of title/body.
- Rewriting already-sent inbox content after delivery.
- Embedding separate push UIs inside News / Facts / Awareness / Interview editors (deep-link into this module instead).
