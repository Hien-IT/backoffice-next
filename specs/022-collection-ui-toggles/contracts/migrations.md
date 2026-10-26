# Contract: migration riêng của Backoffice (D-180)

## `runBackofficeMigrations(knex)` (`apps/api/src/database/backoffice-migrations/run.ts`)

1. `hasTable('backoffice_migrations')` false → `createTable` (`version` string(255) primary, `name` string(255)
   notNullable, `timestamp` timestamp default `knex.fn.now()`).
2. `completed = select version from backoffice_migrations`; `pending = BACKOFFICE_MIGRATIONS.filter(!completed)`.
   Rỗng → `logger.info('Backoffice migrations are up to date')`, return (không lấy lock).
3. `useLock().usingLock('backoffice-migrations', async () => { ... })`:
   - đọc lại `completed`; với mỗi migration còn thiếu theo thứ tự của `index.ts`: `logger.info('Applying <name>...')`,
     `await up(knex)`, `insert({ version, name }) into backoffice_migrations`.
   - Lỗi trong `up` ném ra ngoài (không ghi dòng), `bootstrap` thoát 1 như migration Directus lỗi.
4. Có áp ít nhất một → `flushCaches(true)` (cache hệ thống và data của cả hai app qua Redis, như `migrations/run.ts`).
5. Log trước bước 2: `Running Backoffice migrations...`.

Không có `up` một bước, không `down`, không đọc `MIGRATIONS_PATH`.

## Gọi từ đâu

| Nơi | Khi | Ghi chú |
|-----|-----|---------|
| `cli/commands/bootstrap/index.ts` nhánh Postgres/SQLite | sau `runMigrations(database, 'latest')` ở cả nhánh DB trống và DB đã cài | trước `database.destroy()` |
| `cli/commands/bootstrap/index.ts` nhánh vendor khác (D-145) | sau `bootstrapInstalled`, chỉ khi `await migrationsValid(database)` | thiếu migration Directus: thoát 0 như nay, `start` dừng |
| `cli/commands/init/index.ts` | sau `runMigrations(db, 'latest', false)` (dòng 48) và admin | `init` tự cài DB, không qua `bootstrap` |

`database install`, `database migrate:*` không gọi (output so với Directus).

## Kiểm tra lúc `start` (`database/validate-migrations.ts`)

`checkMigrations` trả thêm `boRequired` (version của `index.ts`), `boCompleted` (bảng; không có bảng = `[]`), `boMissing`,
`boExtra`. `validateMigrations`: sau phần Directus, nếu `boMissing` hoặc `boExtra` khác rỗng:

```
Backoffice migrations do not match.
Missing Backoffice migrations (not run yet): 20261026A
Unknown Backoffice migrations (newer Backoffice?): ...
Run "node cli.js bootstrap" to apply them.
```

rồi `process.exit(1)`. `migrationsValid` = `missing.length === 0 && boMissing.length === 0`.

## Migration `20261026A-add-collection-ui-toggles.ts`

```ts
export const version = '20261026A';
export const name = 'Add Collection UI Toggles';
export async function up(knex: Knex): Promise<void>; // R3: hasColumn → alterTable boolean defaultTo(true); dòng directus_fields nếu chưa có
```

Chỉ `knex` (không service, không `@backoffice/*` ngoài type), chạy trên 7 vendor (`boolean().defaultTo(true)` như
`20211118A`, `20231010A`).

## Quy tắc thêm migration riêng về sau

- File `YYYYMMDD[A-Z]-<ten-kebab>.ts` trong `backoffice-migrations/`, export `version`, `name`, `up`.
- Một dòng trong `index.ts` theo thứ tự version.
- Chỉ: bảng `backoffice_*`; cột `bo_*` trên `directus_*`; dòng `directus_fields` của các cột đó (constitution II).
- `up` chạy lại được; test SQLite in-memory chạy `up` hai lần.
- Cập nhật `dump.ts` của parity nếu thêm cột `bo_*` ở bảng khác `directus_collections` (R6).
