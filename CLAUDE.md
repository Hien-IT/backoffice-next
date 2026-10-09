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

## Recent Changes
- 001-platform-foundation: Added Nx monorepo, NestJS 12 API with ported @directus/env, errors, schema, storage libs, /server/* endpoints, parity tests against Directus
