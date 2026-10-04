# ADR-001: REDI Admin Platform Baseline

**Status:** Accepted  
**Date:** 2026-09-24  
**Context:** Implement `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` on the existing NestJS + Vite monorepo.

## Decision

1. **Deployables (this monorepo):**
   - `apps/api` — shared NestJS REST API (admin + future learner contracts)
   - `apps/admin` — Vite + React admin portal
   - `packages/shared-types` — shared DTOs/permission keys
   - Worker service deferred until Phase 3; long work runs in-process jobs with explicit “queued” status until then

2. **Database:** Prisma with SQLite for local/dev; PostgreSQL is the production target. Schema stays provider-portable (no SQLite-only features beyond what Prisma abstracts).

3. **Admin auth (Phase 0 interim):** JWT Bearer tokens for the admin SPA. HTTP-only cookie sessions + MFA are required before production (Section 5.1); tracked as open decision #2.

4. **Authorization:** Granular permission keys (not role-name checks). Roles are bundles of permissions. Enforced in Nest guards/services.

5. **Audit:** Append-only `AuditEvent` rows written in the same request/transaction as sensitive mutations.

6. **IDs:** CUID/UUID primary keys; editable titles/slugs never replace IDs. Explore section `id`/`slug` stable after publish.

7. **Providers:** Interfaces only in Phase 0–1; unset providers return capability-unavailable (no fabricated success).

8. **API prefix:** Keep `/api` globally; admin resources under `/api/admin/*` with temporary aliases for existing `/students`→learners migration path removed after cutover.

## Consequences

- Existing Student/Batch scaffold is evolved into Learner/Batch + Phase 1 content models.
- Learner mobile app remains out of this repo; API contracts must stay compatible when learner endpoints are added.
- MFA, cookie sessions, Redis queues, S3, and live/payment adapters are not enabled until configured.
