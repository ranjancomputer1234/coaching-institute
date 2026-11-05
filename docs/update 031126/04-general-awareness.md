# Handover 4 — General Awareness

General Awareness lists published topics, then loads one topic with its entries. Explore section metadata is not the topic list.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /awareness/topics` and `GET /awareness/topics/{id}` return 404. The topic grid stays empty.

## Screen

`GeneralAwareness` (`src/screens/awareness/GeneralAwarenessScreen.tsx`) and `TopicDetail`.

- Search sends `search`. The free chip sends `pricing=free`.
- Each card shows title, subtitle, and FREE or PAID.
- Tap opens `GET /awareness/topics/{id}`.
- Detail search matches both `entries.label` and `entries.value` (for example state and capital).
- `schema` chooses the layout: `pairs`, `list`, or `article`.

## Topic list

`GET /awareness/topics`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

```json
{
  "items": [
    {
      "id": "topic-capitals",
      "title": "States and Capitals",
      "summary": "Indian states",
      "pricing": "free",
      "commercialMode": "free",
      "iconKey": "book",
      "imageUrl": null,
      "access": {
        "granted": true,
        "canPreview": true,
        "canDownload": false
      }
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Card id and detail route |
| `title` or `name` | yes | Card title |
| `summary`, `subtitle`, or `description` | no | Card subtitle |
| `pricing` or `commercialMode` | yes | `paid` shows the paid badge |
| `iconKey` | no | Bundled icon. Unknown names fall back to `book` |
| `imageUrl` | no | Optional art |
| `access` | no | Locked topics stay on the grid |

Do not embed `entries` in the list. The detail route owns the entries. A bare array is accepted.

## Topic detail

`GET /awareness/topics/{id}`

```json
{
  "id": "topic-capitals",
  "title": "States and Capitals",
  "summary": "Indian states",
  "pricing": "free",
  "schema": "pairs",
  "summaryChips": ["28 states", "8 union territories"],
  "entries": [
    {
      "id": "entry-bihar",
      "label": "Bihar",
      "value": "Patna",
      "group": "State",
      "iconColor": "#1A237E"
    }
  ],
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false
  }
}
```

| Field | Required | App use |
|---|---|---|
| `schema` | yes | `pairs`, `list`, or `article`. Anything else is treated as `pairs` |
| `summaryChips` | no | Short labels under the title |
| `entries` | yes | Can be an empty array |
| `entries[].id` | yes | Stable id for the reveal and mastered state |
| `entries[].label` | yes | Left side, or the question |
| `entries[].value` or `entries[].text` | yes | Revealed answer |
| `entries[].group` | no | Shown beside the label |
| `entries[].iconColor` | no | Hex color for the entry mark |

`schema: "pairs"` is label plus value, used for states and capitals. `list` is a stack of values. `article` is a longer read that still uses `entries`.

When access is denied, return the topic title and an empty `entries` array with `access.granted: false`. Do not send the answer values.

## Publish rules

- Only published topics.
- Entry ids must stay stable across edits. The app stores which entries a learner has opened on the device.
- Search on the list is title and summary. Search inside a topic is label and value, done on the device from the detail payload.
- Order entries in the teaching order. The app does not sort them.
