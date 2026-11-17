# REDI admin ↔ learner app — prioritized fix lists

Date: 17 November 2026  
Out of scope: live chat

The backlog is split by owner:

| File | For |
|---|---|
| [`PRIORITIZED_FIX_LIST_ADMIN.md`](./PRIORITIZED_FIX_LIST_ADMIN.md) | Admin panel (+ API needed for staff actions) |
| [`PRIORITIZED_FIX_LIST_APP.md`](./PRIORITIZED_FIX_LIST_APP.md) | Learner React Native app (+ API the app must call) |

Shared context: `FULL_SYSTEM_AND_ENDPOINT_REPORT.md`.

### Quick ownership map

| Theme | Admin list | App list |
|---|---|---|
| Lesson publish / empty courses | P0 #1 | P0 #1 (blocked + empty states) |
| Entitlements / paid unlock | P0 #2 | P0 #2 (blocked + CTAs) |
| Production API host | P0 #3 | P0 #3 (config + smoke) |
| Tests / results | P1 #4 | P1 #4 |
| Semesters / projects | P1 #5 | P1 #5 |
| Commerce | P1 #6 | P1 #6 |
| Notifications | P1 #7 | P1 #7 |
| Downloads / legal / live schedule | Admin #8–#9 | App #8–#9, #11 |
| Admin UI gaps & permissions | P2 | — |
| Search / bookmarks / auth extras | light | P2–P3 |
