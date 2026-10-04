# Local development runbook

## Start

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev:api
pnpm dev:admin
```

## Credentials

- `admin@institute.local` / `admin123` (super_admin)

## Rollback notes (Phase 0–1)

- SQLite `dev.db` is disposable; re-run `pnpm db:push` + `pnpm db:seed`.
- Production must use PostgreSQL migrations (`prisma migrate`) — do not use `db push --accept-data-loss` against production.
- JWT secret rotation invalidates all admin sessions.

## Known gaps before production

See ADR-001 and requirements §33: MFA, HTTP-only cookies, Redis worker, object storage, provider adapters.
