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

CMD ["node", "dist/main.js"]
