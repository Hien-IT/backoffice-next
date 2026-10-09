# syntax=docker/dockerfile:1.4
# Static build of apps/web served by nginx under /admin (FR-003). config.json is written at container start from
# the environment (docker/40-config.sh), so one image serves every environment (Principle VII).
# Build context: repository root.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS builder

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

FROM nginx:1.28.0-alpine AS runtime

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 apps/web/docker/40-config.sh /docker-entrypoint.d/40-config.sh
COPY --from=builder /build/apps/web/dist /usr/share/nginx/html/admin

EXPOSE 80
