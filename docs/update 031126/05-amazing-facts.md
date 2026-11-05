# Handover 5 — Amazing Facts

Amazing Facts needs categories and the facts inside them. Reactions are a separate authenticated write. An Explore section titled Amazing Facts does not create facts.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`.

## What is live today

`GET /facts/categories`, `GET /facts`, and `GET /facts/{id}` return 404. The category grid and the fact list stay empty.

## Screen

`AmazingFacts` (`src/screens/facts/AmazingFactsScreen.tsx`), `FactsList`, and `FactDetail`.

- Categories come from `GET /facts/categories`.
- Opening a category calls `GET /facts?categoryId=`.
- A card shows `text`, the heart count, and the saved state.
- `featured` facts can lead the list.
- "Take a Quiz" is shown only when `quizId` is present. That id must be a real test id from `GET /tests/{id}`.
- The heart calls `PUT /facts/{id}/reaction`.

## Categories

`GET /facts/categories`

Query: `search`, `pricing` (`free` or `paid`), `cursor`.

```json
{
  "items": [
    {
      "id": "facts-science",
      "title": "Science",
      "summary": "Short science facts",
      "pricing": "free",
      "iconKey": "bulb"
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Category route. Facts must use this same value as `categoryId` |
| `title` or `name` | yes | Card title |
| `summary`, `subtitle`, or `description` | no | Card subtitle |
| `pricing` | no | Defaults to free |

If this route is missing, the app builds one chip per distinct `categoryId` on `GET /facts`. Publish categories so the titles are real names, not raw ids.

## Fact list

`GET /facts`

Query: `categoryId`, `cursor`.

```json
{
  "items": [
    {
      "id": "fact-1",
      "categoryId": "facts-science",
      "text": "Honey never spoils.",
      "explanation": "Low water and acid keep it stable.",
      "reactionCount": 18,
      "reacted": false,
      "bookmarked": false,
      "featured": true,
      "quizId": null
    }
  ],
  "nextCursor": null,
  "total": 1
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Detail route and reaction route |
| `categoryId` | yes | Must match a category `id` |
| `text` or `title` | yes | The sentence on the card. `title` is used only when `text` is empty |
| `explanation` | no | Detail body |
| `reactionCount` | yes | Number. Use 0, not null |
| `reacted` | yes | Heart fill for this learner. Guests get false |
| `bookmarked` | yes | Guests get false. Signed-in learners get their own value |
| `featured` | no | Lead card |
| `quizId` or `relatedQuizId` | no | Shows "Take a Quiz" and opens that test |

A bare array is accepted. Sort featured facts first, then newest.

## Fact detail

`GET /facts/{id}` returns one object with the same fields as a list row.

## Reaction

`PUT /facts/{id}/reaction`

Auth: bearer token. Guests are stopped in the app before this call.

```json
{ "reacted": true }
```

Return the updated fact, including the new `reactionCount` and `reacted`. The write is idempotent: sending the same value twice does not add a second reaction.

## Publish rules

- Only published categories and published facts.
- `text` is the learner-facing sentence. Do not require the app to join a title and a body.
- `reactionCount` is the server total, not a number the app increments on its own.
- `quizId` must be omitted or null unless that test is published. A dangling id opens a broken quiz.
