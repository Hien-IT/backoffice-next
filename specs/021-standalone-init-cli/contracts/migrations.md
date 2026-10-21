# Contract: seed, migration, `run.ts` và build

## `run(database, direction, log = true)` (port `migrations/run.ts`)

1. Đọc `__dirname` (dist `database/migrations`): giữ file khớp `^[0-9]+[A-Z]-[^.]+\.(?:js|ts)$`; đọc
   `path.resolve(env.MIGRATIONS_PATH)` nếu tồn tại: giữ file có `-` và đuôi `/\.(c|m)?js$/`.
2. `completedMigrations = select * from directus_migrations order by version`.
3. `migrations = [...hệ thống, ...custom]` với `{ file, version, name: formatTitle(...), completed }`, sắp theo `version`
   (so chuỗi). Số phần tử > số version duy nhất → `Error('Migration keys collide! Please ensure that every migration
   uses a unique key.')`.
4. `up`: `nextVersion` = `migrations[0]` nếu chưa có hàng, nếu không là migration đầu tiên có `version >
   completed[last].version && !completed`; không có → `Error('Nothing to upgrade')`; `import(file://...)`; không `up` →
   `logger.warn`; `log` → `Applying <name>...`; `await up(database)`; insert `{ version, name }`; `flushCaches(true)`.
5. `down`: hàng `orderBy(['timestamp','version'], ['desc','desc'])[0]`; không có → `Error('Nothing to downgrade')`;
   không file → `Error("Couldn't find migration")`; `Undoing <name>...`; `await down(database)`; delete theo `version`;
   `flushCaches(true)`.
6. `latest`: với mỗi migration `completed === false` theo thứ tự: `getModuleDefault(import(...))`, cảnh báo nếu không
   `up`, `Applying <name>...`, `up`, insert; có áp → `flushCaches(true)` một lần.

Test: port `run.test.ts` (8 test, `knex-mock-client`), giữ thông điệp lỗi.

## Quy tắc file migration hệ thống (FR-025)

- Chép nguyên văn `directus/api/src/database/migrations/<file>` → `apps/api/src/database/migrations/<file>`.
- Dòng 1: `// Ported from directus/api/src/database/migrations/<file>`.
- Chỉ đổi specifier import theo bảng (R4): `@directus/{utils,utils/node,schema,env,constants,types}` →
  `@backoffice/...`; `../../utils/get-schema.js` → `../../schema/get-database-schema.js`; `../../services/fields.js` →
  `../../services/fields.service.js`; `../../services/settings.js` → `../../services/settings.service.js`.
- `migrations/port.test.ts`: với mỗi file Directus, đọc bản port, bỏ dòng 1, áp bảng thay thế lên bản gốc, so bằng
  nhau; tập version của thư mục (101) = `DIRECTUS_MIGRATIONS` = tập của thư mục Directus.
- Manifest theo task (quy ước repo): `tools/port-manifest/021-T###.json` của task tạo file; 101 migration ở
  `021-T008.json`, `run.test.ts` ở `021-T009.json`, `run.ts` ở `021-T010.json`, 15 seed ở `021-T011.json`,
  `seeds/run.ts` ở `021-T012.json` (tasks.md).

## Bổ sung nhỏ cần cho migration

| Thiếu | Thêm ở | Nguồn Directus |
|-------|--------|----------------|
| `processChunk` | `libs/utils/src/shared/process-chunk.ts` (+ re-export) | `packages/utils/shared/process-chunk.ts` |
| `SettingsModuleBarLink`, `SettingsModuleBarModule` | `libs/types/src/settings.ts` | `packages/types/src/settings.ts:3-18` |
| `uuid` 11.1.0 | `apps/api/package.json` dependencies (catalog gốc đã có) | `api/package.json` |
| `Migration` | `apps/api/src/types/migration.ts` | `api/src/types/migration.ts` |
| `migrationsValid(): Promise<boolean>` | `apps/api/src/database/validate-migrations.ts` (từ `checkMigrations`, `missing.length === 0`) | `database/index.ts validateMigrations` (boolean) |
| `applySnapshot` | `apps/api/src/utils/apply-snapshot.ts` | `api/src/utils/apply-snapshot.ts` |

## Seed

- `apps/api/src/database/seeds/{01..15}-*.yaml` nguyên văn + dòng 1 `# Ported from ...`; `seeds/run.ts` port
  (`getHelpers`, `createTable` theo yaml); `seeds/run.test.ts`: (a) mỗi yaml bằng bản Directus sau khi bỏ dòng 1; (b)
  `Database is already installed`; (c) sqlite in-memory tạo đủ 15 bảng với cột của yaml (kiểm `columnInfo`).
- Build (`apps/api/package.json`): `"build": "swc src -d dist ... && node -e \"<cpSync src→dist lọc .yaml|.liquid>\""`;
  kiểm `dist/database/seeds/*.yaml` (15) và `dist/cli/utils/create-env/env-stub.liquid` có mặt (test nhỏ trong CI job
  `quality` sau `api:build`, hoặc `docker` job `ls`).

## Image

- `apps/api/cli.js` (gốc package): `#!/usr/bin/env node` + `import('./dist/cli/run.js');`; `package.json`: `files:
  ["dist", "cli.js"]`, `bin: { backoffice: "cli.js" }`.
- Dockerfile: builder `mkdir -p dist/database dist/extensions dist/uploads dist/migrations`; runtime `CMD ["/bin/sh",
  "-c", "node cli.js bootstrap && exec node cli.js start"]`; `ENTRYPOINT ["/sbin/tini", "--"]` giữ.
- Bố cục `/directus`: `package.json`, `cli.js`, `dist/` (main.js, cli/run.js, database/{seeds,migrations}), `node_modules/`,
  `database/`, `extensions/`, `uploads/`, `migrations/` [Unverified cho tới T-task `ls` trong image].

## Kiểm tra lúc `start` (001, không đổi)

`validateMigrations()` của `start`: thiếu hoặc thừa → dừng mã 1 (D-05, D-06). Vì CMD chạy `bootstrap` trước, DB trống
hoặc thiếu custom migration đều được áp trước khi `start` kiểm (Postgres, SQLite); vendor khác: `bootstrap` không migrate
nên `start` dừng nếu thiếu (tài liệu: chạy `migrate:latest` bằng image Directus).
