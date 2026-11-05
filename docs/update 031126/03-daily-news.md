# Handover 3 — News

Daily News needs two published collections: categories for the chips, and articles for the feed. An Explore section named News does not create either collection.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /news/categories`, `GET /news`, and `GET /news/{id}` return 404. The category row and the story list stay empty.

## Screen

`DailyNews` (`src/screens/news/DailyNewsScreen.tsx`) and `NewsFeed` / `NewsArticle`.

- Category chips come from `GET /news/categories`.
- Stories come from `GET /news`. The featured story is the article with `featured: true`, otherwise the first article.
- Each story shows title, excerpt, byline, reading time, date, and `imageUrl`.
- A locked story (`access.granted: false`) stays in the list and shows the lock state.
- Tap opens `GET /news/{id}`.

## Categories

`GET /news/categories`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

```json
{
  "items": [
    {
      "id": "news-national",
      "title": "National",
      "summary": "India and policy",
      "pricing": "free",
      "iconKey": "news"
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Chip id. Articles must use this same value as `categoryId` |
| `title` or `name` | yes | Chip label |
| `summary`, `subtitle`, or `description` | no | Secondary line |
| `pricing` | no | Defaults to free when omitted. `paid` shows the paid badge |

If this route is missing, the app tries to invent chips from `categoryId` on `GET /news`. Publish this route so chip ids are stable.

## Article list

`GET /news`

Query: `categoryId`, `cursor`, and optionally `search`.

```json
{
  "items": [
    {
      "id": "news-1",
      "categoryId": "news-national",
      "title": "Cabinet clears the new skilling plan",
      "excerpt": "A short summary for the card.",
      "byline": "RACI News",
      "publishedAt": "2026-11-03T08:00:00.000Z",
      "readingMinutes": 3,
      "tags": ["policy", "jobs"],
      "featured": true,
      "imageUrl": "https://cdn.example.com/news-1.jpg",
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
| `id` | yes | Article route |
| `categoryId` | yes | Must match a category `id`. Missing ids are grouped as `news` |
| `title` | yes | Card and reader title |
| `excerpt` or `summary` | no | Card summary and in-feed search |
| `byline` | no | Defaults to "RACI News" |
| `publishedAt` or `createdAt` | yes | Card date. ISO-8601 |
| `readingMinutes` or `readingTime` | no | Defaults to 3 |
| `tags` | no | Search |
| `featured` | no | One article should be the top story |
| `imageUrl` or `heroImageUrl` | no | Card image |
| `access` | no | Denied access still returns the card fields. Omit the full body until access is granted |

The app also accepts `body` on the list, but the list screen does not render it. Keep the list light.

## Article detail

`GET /news/{id}`

```json
{
  "id": "news-1",
  "categoryId": "news-national",
  "title": "Cabinet clears the new skilling plan",
  "excerpt": "A short summary for the card.",
  "byline": "RACI News",
  "publishedAt": "2026-11-03T08:00:00.000Z",
  "readingMinutes": 3,
  "body": [
    "First paragraph.",
    "Second paragraph."
  ],
  "highlights": ["Point one", "Point two"],
  "tags": ["policy"],
  "featured": true,
  "imageUrl": "https://cdn.example.com/news-1.jpg",
  "access": {
    "granted": true,
    "canPreview": true,
    "canDownload": false
  }
}
```

`body` may be a string or an array of paragraph strings. The app splits a string into one block. When `access.granted` is false, return the title and excerpt and an empty `body` rather than the paid article.

## Publish rules

- Only published categories and published articles.
- `categoryId` on every article must exist in `GET /news/categories`.
- Sort newest `publishedAt` first.
- Guests can read free articles. Paid articles remain in the feed with `access.granted: false` and `reason: "login_required"` or `"purchase_required"`.
