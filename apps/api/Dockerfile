# Build context is the repository root (pnpm workspace + root lockfile).
#   docker build -f apps/api/Dockerfile .

FROM node:22-bookworm-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@10.8.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter api...

COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate \
  && pnpm --filter api build

FROM node:22-bookworm-slim
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
# Dev dependencies stay: the Prisma CLI runs `migrate deploy` before each release.
COPY --from=build /app /app
WORKDIR /app/apps/api
USER node
EXPOSE 3333
CMD ["node", "dist/src/main"]
