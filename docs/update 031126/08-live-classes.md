# Handover 8 — Live classes

Home and the Live tab list published classes. The home card shows the title, time, and one action. The Live tab groups the same rows by day. Neither screen reads Explore sections.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /live-classes` returns 404. Home hides the live carousel, and the Live tab shows an empty schedule, until this route returns published classes.

## Where the app calls it

| Screen | Request |
|---|---|
| Home carousel | `GET /live-classes?from=&to=` covering the last 24 hours through the next 14 days |
| Live tab | Same route, last 24 hours through the next 7 days |
| Live room | `GET /live-classes/{id}` |

`from` and `to` are ISO-8601 timestamps. Return every published class whose `startsAt` falls in that window, including a class that already started today.

## Class list

`GET /live-classes`

```json
[
  {
    "id": "live-tally-1",
    "title": "Tally Prime — GST entries",
    "startsAt": "2026-11-03T14:30:00.000Z",
    "endsAt": "2026-11-03T15:30:00.000Z",
    "instructorName": "RACI Faculty",
    "status": "scheduled",
    "batch": "Morning batch",
    "durationLabel": "60 min",
    "viewerCount": 0,
    "recordingAvailable": false,
    "reminderSet": false
  }
]
```

A page object with `items` is also accepted.

| Field | Required | App use |
|---|---|---|
| `id` | yes | Home action and live room route |
| `title` | yes | Home card and schedule row |
| `startsAt` | yes | Home time and the day chip. Also accepted as `startAt` |
| `endsAt` | yes | Duration when `durationLabel` is empty. Also accepted as `endAt` |
| `instructorName` | yes | Schedule row. A nested `instructor.name` is accepted |
| `status` | yes | One of `scheduled`, `starting`, `live`, `reconnecting`, `ended`, `cancelled` |
| `batch` or `batchName` | no | Shown after the instructor on an upcoming class |
| `durationLabel` | no | Home does not draw this. The schedule uses it, or computes minutes from start and end |
| `viewerCount` | no | Shown while the class is live, as "120 watching" |
| `recordingAvailable` | yes | `true` only when a replay can be played. Ended classes without it do not show Watch |
| `reminderSet` | yes for a signed-in learner | Bell state. Guests get `false` |

Unknown `status` values are treated as `scheduled`.

## What each status shows

| `status` | Home label | Home button | Schedule row |
|---|---|---|---|
| `scheduled` | "Starts 3 Nov, 8:00 pm" | View Class | Time, instructor, reminder bell |
| `starting` | Starting now | Join Now | LIVE |
| `live` | Live now | Join Now | LIVE, plus viewer count |
| `reconnecting` | Reconnecting | Join Now | LIVE |
| `ended` and `recordingAvailable: true` | Recording available | Watch Replay | Watch |
| `ended` and `recordingAvailable: false` | Class ended | Join Now opens the room with no replay | "ended", no Watch button |
| `cancelled` | Class cancelled | Button disabled | Still listed on that day |

The home carousel is hidden when the list is empty. It is not an image banner. Title, time, and the action button are part of this card.

## Class detail

`GET /live-classes/{id}` returns one object with the same fields. The room shows title, batch, start time, duration, instructor name, and viewer count.

Return 404 for a draft, archived, or unknown id.

## Join

`POST /live-classes/{id}/join`

Auth: bearer token. Empty body. Guests are sent to sign in before this call.

```json
{
  "playbackUrl": "https://cdn.example.com/live/live-tally-1/index.m3u8",
  "chatAvailable": false,
  "expiresAt": "2026-11-03T15:35:00.000Z"
}
```

| Field | Required | App use |
|---|---|---|
| `playbackUrl` | yes while the class is live or a replay exists | Played in the room. Omit or null when the stream is not ready |
| `chatAvailable` | yes | The app still keeps chat off until a later release. Send `false` |
| `expiresAt` | no | When the playback URL stops working |

Join must check that the class is live, starting, or has a recording, and that this learner is allowed in. A denied learner gets 403, not a playback URL.

## Reminder

`PUT /live-classes/{id}/reminder`

Auth: bearer token.

```json
{ "enabled": true }
```

Return 204. The app only sends this for a class that has not started. `reminderSet` on the next list response must match the stored value for that learner.

## Hand

`PUT /live-classes/{id}/hand`

Auth: bearer token.

```json
{ "raised": true }
```

Return `{ "raised": true }` or `{ "raised": false }`.

## Publish rules

- Only published classes inside the requested `from` / `to` window.
- Store `startsAt` and `endsAt` in UTC. The app formats them in the phone timezone.
- Set `status` on the server. The app does not decide that a class is live from the clock alone.
- Set `recordingAvailable` only after the replay file is actually playable through `playbackUrl`.
- Chat is not shown in this app build. Do not require chat to join a class.
