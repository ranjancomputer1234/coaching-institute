# Deploying to Railway

The Railway project is defined in code in [`.railway/railway.ts`](../.railway/railway.ts) (Railway Infrastructure as Code — the replacement for the deprecated `railway.json`). It creates three services:

| Service    | Source                                    | Health check   | Notes |
| ---------- | ----------------------------------------- | -------------- | ----- |
| `postgres` | Railway Postgres (SSL)                    | —              | Managed database |
| `api`      | `apps/api/Dockerfile` (built from repo root) | `/api/health` | Runs `prisma migrate deploy` before every deploy |
| `admin`    | `apps/admin/Dockerfile` (built from repo root) | `/healthz`  | Static SPA served by nginx |

## How CI/CD works

1. Every push and pull request runs `.github/workflows/ci.yml`:
   - **API:** lint, unit tests, build, migrate + seed a throwaway Postgres, e2e tests, then boot the API and run `pnpm smoke` (every admin and learner endpoint).
   - **Admin:** lint and production build.
   - **Docker:** builds both Dockerfiles exactly as Railway does, and checks that the admin container serves the SPA.
2. Both Railway services track `main` with `checkSuites: true`, so **Railway only deploys a commit after CI passes on it**. A red CI run never reaches production.
3. `watchPatterns` mean an admin-only change does not redeploy the API (and vice versa). Changes to the root `package.json`, `pnpm-lock.yaml` or `pnpm-workspace.yaml` redeploy both.
4. On each API deploy, Railway runs `npx prisma migrate deploy` first; if a migration fails, the old version keeps serving traffic.
5. Pull requests that touch `.railway/**` get a `railway config plan` comment from `.github/workflows/railway-config.yml` (only once the `RAILWAY_TOKEN` secret is set).

## First-time setup

Prerequisites: Railway CLI **5.42.1 or newer** (`npm i -g @railway/cli`), and the Railway GitHub app installed with access to `ranjancomputer1234/coaching-institute`.

```bash
pnpm install                 # installs the `railway` IaC SDK used by .railway/railway.ts
railway login
railway init                 # or: railway link, to use an existing empty project
railway config plan          # preview what will be created
railway config apply         # create postgres, api and admin
```

### 1. Set the secrets (before the first API deploy succeeds)

The API refuses to start in production unless these three are set, each **at least 32 characters** and **all different**. Set them on the `api` service in the Railway dashboard (Variables tab). `preserve()` in `railway.ts` means `railway config apply` never overwrites them.

| Variable               | Purpose |
| ---------------------- | ------- |
| `JWT_SECRET`           | Signs admin access tokens |
| `LEARNER_JWT_SECRET`   | Signs learner access tokens |
| `OFFLINE_GRANT_SECRET` | Signs offline download grants |

Generate each one with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 2. Generate public domains

In the dashboard, open **api → Settings → Networking → Generate Domain**, then do the same for **admin**. The variables in `railway.ts` already reference these domains:

- `CORS_ORIGIN` on the API = the admin domain
- `PROTECTED_CONTENT_BASE_URL` on the API = the API domain
- `VITE_API_BASE_URL` on the admin = the API domain (baked into the bundle at build time)

After generating the domains, **redeploy admin** so the bundle picks up the API URL.

If you later attach custom domains, update `CORS_ORIGIN` (API) and `VITE_API_BASE_URL` (admin) to match, then redeploy both.

### 3. Seed roles and the first admin (once)

Migrations create the schema, but roles, permissions and the first admin come from `prisma/seed.ts`, which production never runs automatically. Run it once against the production database:

```bash
railway ssh --service api
npx tsx prisma/seed.ts
exit
```

The seed also creates demo content and the well-known login `admin@institute.local` / `admin123`. Immediately afterwards:

1. Log in to the admin panel with that account.
2. Create your real `super_admin` under **Staff**, using a strong password.
3. Log in as the new account and **deactivate `admin@institute.local`**.
4. Archive or deactivate the demo learners and courses you don't want.

Don't run the seed again on production after real data exists.

### 4. Optional: IaC plan comments on PRs

Create a Railway **project token** (Project Settings → Tokens) and add it as the GitHub Actions secret `RAILWAY_TOKEN`. PRs that change `.railway/**` will then get a plan comment, and the config is applied once they merge.

## Environment variables reference

| Service | Variable | Value |
| ------- | -------- | ----- |
| api | `APP_ENV` | `production` |
| api | `DATABASE_URL` | `${{postgres.DATABASE_URL}}?sslmode=require` (the API requires SSL in production) |
| api | `JWT_SECRET`, `LEARNER_JWT_SECRET`, `OFFLINE_GRANT_SECRET` | Set manually (see above) |
| api | `JWT_EXPIRES_IN` / `LEARNER_JWT_EXPIRES_IN` | `1d` / `30d` |
| api | `CORS_ORIGIN` | `https://${{admin.RAILWAY_PUBLIC_DOMAIN}}` |
| api | `PROTECTED_CONTENT_BASE_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}/api/protected/delivery` |
| api | `OFFLINE_GRANT_KID` | `redi-offline-v1` |
| api | `DOWNLOAD_SESSION_TTL_SECONDS` / `OFFLINE_DOCUMENT_TTL_SECONDS` / `OFFLINE_VIDEO_TTL_SECONDS` | `900` / `604800` / `259200` |
| admin | `VITE_API_BASE_URL` | `https://${{api.RAILWAY_PUBLIC_DOMAIN}}` (origin only — the client adds `/api`) |
| admin | `VITE_APP_ENV` | `production` |

Railway injects `PORT` into both services; the API and the nginx config both listen on it.

## Verifying a deploy

```bash
curl https://<api-domain>/api/health        # {"status":"ok","database":"ok"}
curl https://<admin-domain>/healthz         # ok
```

To run the full endpoint smoke test against a deployed API (it creates test records, so point it at staging, not production):

```bash
API_URL=https://<api-domain>/api pnpm smoke
```

## Video: what is and isn't deployed

There is **no video upload or processing pipeline yet**. The admin "Lessons & resources" screen only saves resource metadata (title, kind, storage key). The API has no file upload endpoint, no object storage client, and no transcoding/HLS packaging. `/api/protected/delivery` returns `metadata_only_until_storage_wired`. Video DRM licences are issued only for resources with `drmScheme`, `drmContentId` and `licenseServiceUrl` configured.

Railway volumes are not a good fit for video files. When this is built, use object storage (S3, Cloudflare R2 or similar) with direct-to-bucket signed uploads, plus a managed transcoding/DRM provider (e.g. Mux, Cloudflare Stream, or AWS MediaConvert with a DRM vendor).
