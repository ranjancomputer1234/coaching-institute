# Handover 7 — Home banners

The home carousel shows the banner image and nothing else. It does not draw a title, subtitle, caption, or button. Any words or call to action must already be inside the image file.

Learner base: `https://redi-api-production.up.railway.app/api`

The app never calls `/admin/*`. Banners are read from `GET /home` (and `GET /home/me` when the learner is signed in).

## What is live today

`GET /home` returns banner rows, and the current rows have `imageUrl: null`. The app drops those rows, so the carousel stays empty until each published banner has an image.

## Screen

Home (`src/screens/home/HomeScreen.tsx`)

- One full-width image per slide, 148pt tall, cover-cropped, rounded corners.
- No title, subtitle, `ctaLabel`, or other text drawn by the app.
- No button on the slide.
- Slides advance every 10 seconds when there are two or more images.
- Dots switch slides. The dots have no labels from the banner title.
- If `targetKind` and `targetRef` are set, tapping the image opens that target. The tap target is the image itself, not a visible button.
- A banner with no `imageUrl`, or an image that fails to load, is not shown.

## Payload

Banners are the `banners` array on `GET /home`.

```json
{
  "banners": [
    {
      "id": "banner-welcome",
      "imageUrl": "https://cdn.example.com/banners/welcome-1080x432.jpg",
      "altText": "Start learning with REDI",
      "targetKind": "catalog",
      "targetRef": "course",
      "placement": "hero",
      "priority": 10,
      "lifecycle": "published"
    }
  ]
}
```

| Field | Required | App use |
|---|---|---|
| `id` | yes | Slide identity |
| `imageUrl` | yes | The only thing drawn. HTTPS URL of a landscape image |
| `altText` | no | Screen reader only. Not drawn on the slide |
| `targetKind` | no | Used only when the image is tapped |
| `targetRef` | no | Used with `targetKind`. Same values as Explore targets, for example `course`, `course,free`, `exam` |
| `priority` | no | Higher number should come first. The app shows the array in the order received |
| `placement` | no | Only `hero` belongs on this carousel |

Ignored on the home carousel, even if the admin still stores them: `title`, `subtitle`, `ctaLabel`, `campaignName`, `themeKey`. Do not rely on those fields to communicate the offer. Put that content in the image.

## Image

- Landscape, about 1080×432, or the same 2.5:1 ratio.
- Safe area: keep important artwork inside the center. The app uses `cover`, so the left and right edges can crop on narrow phones.
- JPG or PNG. No text overlay is added by the app, so the file must be readable on its own.
- Do not send a banner until `imageUrl` is a public URL the phone can load without an admin cookie.

## Target

Tapping the image calls the same router as an Explore section.

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
| `course` | course id | That course |
| `section` | section slug | Only when the app already knows that slug |

Omit `targetKind` when the image should not navigate. The slide is then not pressable.

## Publish rules

- Only `lifecycle: "published"` banners, inside their `startsAt` / `endsAt` window.
- Sort by `priority` descending before returning the array.
- Return at most the hero placement. Other placements are not shown.
- A banner without `imageUrl` must be left out of the learner payload. The app will drop it anyway.
