# syntax=docker/dockerfile:1.4
# Follows directus/Dockerfile (research R20), without `bootstrap` and PM2: one Node process per container.
# Build context: repository root.

ARG NODE_VERSION=22.23.3-alpine3.24

####################################################################################################
## Build

FROM node:${NODE_VERSION} AS builder

RUN npm install --global corepack@latest

RUN apk --no-cache add python3 py3-setuptools build-base

WORKDIR /backoffice

COPY package.json .
RUN corepack enable && corepack prepare

RUN chown node:node .
USER node

COPY --chown=node:node pnpm-lock.yaml .
RUN pnpm fetch

COPY --chown=node:node . .
RUN <<EOF
	set -ex
	pnpm install --recursive --offline --frozen-lockfile
	pnpm --filter '@backoffice/api...' run build
	pnpm --filter @backoffice/api deploy --legacy --prod dist
	mkdir -p dist/database dist/extensions dist/uploads dist/migrations
EOF

####################################################################################################
## Runtime

FROM node:${NODE_VERSION} AS runtime

# FR-026: Node as PID 1 does not reap orphaned children (zombies); tini does and forwards signals to Node.
# D-183: /directus links to /backoffice, so extensions that load files of the DR image by absolute path
# (createRequire('/directus/package.json'), /directus/node_modules/.pnpm/...) find the same files here.
RUN apk add --no-cache tini && ln -s /backoffice /directus

# FR-020, FR-025: uid/gid 1000 (`node`) like the DR image, so files on a shared volume keep one owner.
USER node

# Owner 2026-10-24 (D-174, revises FR-017 of 019): the working directory is /backoffice, not the /directus of the DR
# image. Relative paths of a shared config (./uploads, ./extensions, ./migrations, .env) resolve here, so volumes mount
# at /backoffice/...; swapping a DR container for this image means moving its mounts.
WORKDIR /backoffice

ENV \
	DB_CLIENT="sqlite3" \
	DB_FILENAME="/backoffice/database/database.sqlite" \
	NODE_ENV="production" \
	NPM_CONFIG_UPDATE_NOTIFIER="false"

COPY --from=builder --chown=node:node /backoffice/dist .

EXPOSE 8055

# Feature 019 (FR-022): version labels, last so that a new commit keeps the cached layers (CI sets both ARGs).
ARG BACKOFFICE_VERSION=0.0.0
ARG VCS_REF=unknown
LABEL \
	org.opencontainers.image.title="backoffice-api" \
	org.opencontainers.image.version="${BACKOFFICE_VERSION}" \
	org.opencontainers.image.revision="${VCS_REF}" \
	maintainer="Hien Nguyen"

ENTRYPOINT ["/sbin/tini", "--"]
# Spec 021 (FR-001, FR-060): like `node cli.js bootstrap && pm2-runtime start` of the DR image: bootstrap (install an
# empty database, run pending migrations) then start; `exec` keeps node a direct child of tini. A failed bootstrap
# exits with its code and the server never starts. `node dist/main.js` still works for an overridden command (019).
CMD ["/bin/sh", "-c", "node cli.js bootstrap && exec node cli.js start"]
