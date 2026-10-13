# REDI — Coaching Institute Solution

Monorepo for **REDI (Ranjan Educational Institute)** admin control plane and shared API.

Implements Phase 0–1 of [`docs/WEB_ADMIN_PANEL_REQUIREMENTS.md`](docs/WEB_ADMIN_PANEL_REQUIREMENTS.md).

## Stack

- `apps/api` — NestJS + Prisma (PostgreSQL)
- `apps/admin` — Vite + React + TanStack Query admin portal
- `packages/shared-types` — shared DTOs and permission keys

## Docs

| Doc | Purpose |
|-----|---------|
| `docs/WEB_ADMIN_PANEL_REQUIREMENTS.md` | Full product requirements |
| `docs/architecture-decisions/001-admin-platform-baseline.md` | Architecture decisions |
| `docs/PERMISSION_MATRIX.md` | Role → permission mapping |
| `docs/IMPLEMENTATION_PLAN.md` | Phased delivery status |
| `docs/api/openapi-draft.md` | Admin + learner API surface |
| `docs/backend-handoff.md` | Learner protected-download API handoff |
| `docs/protected-downloads.md` | API-side download/offline policy |
| `docs/APP_DEVELOPER_HANDOVER.md` | Learner app developer handover: endpoints + sample data |
| `docs/DEPLOY_RAILWAY.md` | Railway deployment and CI/CD |

## Setup

Install once from the repo root, then configure each app separately:

```bash
pnpm install
```

## Run each app on its own

API and admin do not share an env file. Copy the example next to that app, then start it from that folder (or with the root filter scripts).

**API** — `apps/api/.env`

```bash
cd apps/api
# copy .env.example to .env if you do not already have one
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

- http://localhost:3333/api

**Admin** — `apps/admin/.env`

```bash
cd apps/admin
# copy .env.example to .env if you do not already have one
pnpm dev
```

- http://localhost:5173

`VITE_API_BASE_URL` in the admin env must point at the API origin. `CORS_ORIGIN` in the API env must include the admin origin (`http://localhost:5173` by default).

From the repo root, the same processes are:

```bash
pnpm dev:api
pnpm dev:admin
```

## Default admin login

- Email: `admin@institute.local`
- Password: `admin123`
- Role: `super_admin` (all permissions)

## Phase 1 capabilities

- Dashboard, learners, batches, courses, explore, banners, audit

## Phase 2 capabilities

- Question bank (single_choice only for mobile)
- Test builder with publish validation
- Attempts with snapshot scoring + idempotent submit
- Results publication
- Projects accept / request-changes
- Semester review approve (unlocks next semester atomically)

## Environment

| App | Local file | Production template |
|-----|------------|---------------------|
| API | `apps/api/.env` | `apps/api/.env.production.example` |
| Admin | `apps/admin/.env` | `apps/admin/.env.production.example` |

Local API credentials point at PostgreSQL from `docker-compose.yml` (`redi` / `redi_local_dev` on port 5432). That password is for this machine only.

Production uses a hosted PostgreSQL database with SSL. Copy the production example, replace every `CHANGE_ME`, and keep the filled file out of git. `APP_ENV=production` refuses to start if the database is not PostgreSQL with `sslmode=require`, or if the three signing secrets are short, identical, or still placeholders.

```bash
docker compose up -d postgres
cd apps/api
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

Admin production build:

```bash
cd apps/admin
# copy .env.production.example to .env.production and set the real API URL
pnpm build
```
