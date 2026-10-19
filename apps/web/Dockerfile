# syntax=docker/dockerfile:1.4
# Static build of apps/web served by nginx under /admin (FR-003). config.json is written at container start from
# the environment (docker/40-config.sh), so one image serves every environment (Principle VII).
# Build context: repository root.

ARG NODE_VERSION=22.23.3-alpine3.24

FROM node:${NODE_VERSION} AS builder

RUN npm install --global corepack@latest

WORKDIR /build

COPY package.json .
RUN corepack enable && corepack prepare

RUN chown node:node .
USER node

COPY --chown=node:node pnpm-lock.yaml .
RUN pnpm fetch

COPY --chown=node:node . .
RUN pnpm install --recursive --offline --frozen-lockfile --filter '@backoffice/web...' \
	&& pnpm --filter @backoffice/web run build

# Unprivileged nginx on port 8080, run as uid/gid 1001 (FR-025, owner decision 2026-10-20) instead of the image's 101:
# 1001 owns the nginx cache and conf.d (pid file in /tmp) and the build, so 40-config.sh can write config.json and csp.inc.
FROM nginxinc/nginx-unprivileged:1.28.0-alpine AS runtime

USER root
RUN addgroup -S -g 1001 backoffice \
	&& adduser -S -D -H -u 1001 -G backoffice backoffice \
	&& chown -R 1001:1001 /var/cache/nginx /etc/nginx/conf.d

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/docker/csp.awk /etc/nginx/csp.awk
# Empty until 40-config.sh writes the header at start.
COPY --chown=1001:1001 apps/web/docker/csp.inc /etc/nginx/conf.d/csp.inc
COPY --chmod=755 apps/web/docker/40-config.sh /docker-entrypoint.d/40-config.sh
COPY --from=builder --chown=1001:1001 /build/apps/web/dist /usr/share/nginx/html/admin

USER 1001:1001

EXPOSE 8080

# Feature 019 (FR-022): version labels, last so that a new commit keeps the cached layers (CI sets both ARGs).
ARG BACKOFFICE_VERSION=0.0.0
ARG VCS_REF=unknown
LABEL \
	org.opencontainers.image.title="backoffice-web" \
	org.opencontainers.image.version="${BACKOFFICE_VERSION}" \
	org.opencontainers.image.revision="${VCS_REF}"
