# syntax=docker/dockerfile:1.4
# Follows directus/Dockerfile (research R20), without `bootstrap` and PM2: one Node process per container.
# Build context: repository root.

ARG NODE_VERSION=22.23.3-alpine3.24

####################################################################################################
## Build

FROM node:${NODE_VERSION} AS builder

RUN npm install --global corepack@latest

RUN apk --no-cache add python3 py3-setuptools build-base

WORKDIR /directus

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
	mkdir -p dist/database dist/extensions dist/uploads
EOF

####################################################################################################
## Runtime

FROM node:${NODE_VERSION} AS runtime

# FR-026: Node as PID 1 does not reap orphaned children (zombies); tini does and forwards signals to Node.
RUN apk add --no-cache tini

# FR-020, FR-025: uid/gid 1000 (`node`) like the Directus image, so files on a shared volume keep one owner.
USER node

# Same working directory and defaults as the Directus image, so relative paths in a shared config
# (./uploads, .env, DB_FILENAME) point to the same place (FR-017).
WORKDIR /directus

ENV \
	DB_CLIENT="sqlite3" \
	DB_FILENAME="/directus/database/database.sqlite" \
	NODE_ENV="production" \
	NPM_CONFIG_UPDATE_NOTIFIER="false"

COPY --from=builder --chown=node:node /directus/dist .

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
CMD ["node", "dist/main.js"]
