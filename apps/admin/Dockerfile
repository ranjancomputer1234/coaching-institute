# Build context is the repository root (pnpm workspace + root lockfile).
#   docker build -f apps/admin/Dockerfile --build-arg VITE_API_BASE_URL=https://api.example.com .

FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@10.8.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter admin...

COPY apps/admin apps/admin

# Vite bakes these into the static bundle at build time.
ARG VITE_API_BASE_URL
ARG VITE_APP_ENV=production
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_APP_ENV=$VITE_APP_ENV
RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL is required to build the admin panel" >&2 && exit 1)
RUN pnpm --filter admin build

FROM nginx:1.27-alpine
ENV PORT=8080
# Only substitute PORT. Otherwise envsubst can rewrite nginx vars like $uri.
ENV NGINX_ENVSUBST_FILTER=^PORT$
COPY apps/admin/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html
EXPOSE 8080
