## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Active Technologies
- TypeScript 5.9.3 (strict flags of @directus/tsconfig 4.0.0), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; API: NestJS 12 (Express 5) + Knex 3.1, ioredis, pino, prom-client; Web: Vue 3.5 + Pinia + Vue Router (Reka UI + Tailwind CSS 4 from feature 012); tests: Vitest 3.2.4, Playwright, autocannon (001-platform-foundation)
- Shared DB with Directus 11.17.4 (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB), read-only in 001; shared Redis and storage (local, S3) (001-platform-foundation)
- @backoffice/memory (port of @directus/memory: Redis bus, kv, multi cache; lru-cache 11.2.2, @sesamecare-oss/redlock 1.4.0); in-process SchemaOverview cache shared with Directus via Redis lock/bus (002-schema-overview-cache)
- Auth: jsonwebtoken 9.0.3, argon2 0.44.0, otplib 12.0.1, openid-client 5.7.1, ldapts 8.1.3, joi 18.2.6 (security patch, Directus has 18.0.1), flat 6.0.1 (otherwise the same versions as Directus 11.17.4); @backoffice/validation (port of @directus/validation); writes directus_sessions/activity/revisions and shares SECRET, sessions and Redis login-attempt counters with Directus (003-auth-session)
- Permissions: full port of the Directus read/write engine (get-ast-from-query, run-ast, ItemsService, PayloadService, MetaService, dialect helpers) and permissions modules; snappy 7.3.3 (cache value compression), ip-matching 2.1.2; shared permissions cache namespaces and data-cache clearing; Directus app E2E through an nginx reverse proxy with Playwright 1.64.0 (004-permissions)
- Items: /items on the 004 engine; response cache shared with Directus (object-hash key with version 11.17.4, Keyv data cache, CACHE_SKIP_ALLOWED in parity env); export via json2csv 5.0.7, js2xmlparser 5.0.0, js-yaml; real Emitter (eventemitter2 6.4.9) and the websocket.event bus bridge gated by WEBSOCKETS_*; Directus blackbox items/query/relational suite ported under tests/parity/src/items/blackbox (005-items)

## Recent Changes
- 001-platform-foundation: Added Nx monorepo, NestJS 12 API with ported @directus/env, errors, schema, storage libs, /server/* endpoints, parity tests against Directus
