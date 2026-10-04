# Implementation plan

Status against `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md`.

## Done in this monorepo

- Phase 0 baseline: JWT admin auth, granular permissions, audit events, Prisma schema, seed, shared types, admin shell.
- Phase 1: dashboard, learners, batches, courses, lessons/resources, explore, banners, editorial content, reports, audit, settings.
- Phase 2: question bank, tests, attempts, scoring, results, projects, semester review.
- Learner API: register/login/profile, catalogue, enrollments, protected download authorization.
- Phase 3 records: notification templates and campaigns, live-class drafts. Send and room creation report **not configured** until `PUSH_PROVIDER_KEY` or `LIVE_PROVIDER_BASE_URL` is set. No delivery or join link is invented.
- Phase 4 records: products, coupons, pending orders, manual reconciliation, refund requests, certificates and admit cards. Payment capture and gateway refunds stay unavailable until `PAYMENT_PROVIDER_KEY` is set. Document issue stores an encrypted storage key, not a rendered PDF binary.
- Staff accounts and role assignment.

## Still outside this codebase

- MFA and HTTP-only cookie sessions (required before production).
- Object storage streaming, Widevine/FairPlay license service, PDF renderer.
- Real payment, push, and live-video adapters.
- CI pipeline, load tests, and a production rollout runbook beyond `docs/runbooks/local-dev.md`.
- Prisma migrate history. Local setup uses `pnpm db:push`.

## Local setup

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev:api
pnpm dev:admin
```
