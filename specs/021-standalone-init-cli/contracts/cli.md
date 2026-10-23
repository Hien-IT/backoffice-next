# Contract: CLI `node cli.js` (port `directus/api/src/cli`)

Mọi lệnh chạy ở `/directus` của image (`WORKDIR`; từ 2026-10-24 là `/backoffice`, D-174 của 019), đọc cùng env như server. Exit code, stdout và log như Directus
11.17.4 trừ các chuỗi ở mục "Thương hiệu".

## Cây lệnh (commander 14, `allowExcessArguments`)

| Lệnh | Option / argument | Hành vi | Mã thoát |
|------|-------------------|---------|----------|
| `start` | — | như `dist/main.js`: startup checks (001, gồm `validateMigrations`), `startServer()` | chạy mãi; lỗi 1 |
| `init` | hỏi đáp | chọn vendor (`PostgreSQL / Redshift`, `SQLite`), câu hỏi kết nối, seed + `latest` (log tắt) tối đa 5 lần, `.env` (0640), admin đầu tiên (insert thẳng), in hướng dẫn | 0; 5 lần lỗi 1 |
| `security key:generate` | — | stdout `randomUUID()` không xuống dòng | 0 |
| `security secret:generate` | — | stdout `nanoid(32)` không xuống dòng | 0 |
| `database install` | — | `runSeed`; vendor ngoài Postgres/SQLite → lỗi D-145 | 0; lỗi (kể cả `Database is already installed`) 1 |
| `database migrate:latest` | — | `Running migrations...`, `run('latest')`, `Database up to date` | 0; lỗi 1; vendor khác 1 |
| `database migrate:up` | — | áp một migration, `Database up to date` | 0; `Nothing to upgrade` 1 |
| `database migrate:down` | — | gỡ một migration, `Downgrade successful` | 0; `Nothing to downgrade` / `Couldn't find migration` 1 |
| `users create` | `--email --password --role` | `UsersService.createOne({ email, password, role, status: 'active' })`; stdout `<id>\n` | 0; thiếu → `Email, password, role are required` 1 |
| `users passwd` | `--email --password` | `LOWER(email)`; update `directus_users.password` = argon2 | 0 `Password is updated for user <id>`; không có `No such user by this email` 1 |
| `roles create` | `--role <tên> [--admin] [--app]` | policy `Policy for <tên>` (icon `supervised_user_circle`), role, access; stdout `<roleId>\n` | 0; thiếu `Name is required` 1 |
| `cache clear` | `[--system] [--data]` | `CACHE_STORE !== 'redis'` → in dòng của Directus, 0; else `clearSystemCache({ forced: true })` và/hoặc `cache.clear()`; `Cleared <target> successfully` | 0; lỗi 1 |
| `count <collection>` | — | `count('*')`; stdout `<n>\n` | 0; thiếu/lỗi 1 |
| `bootstrap` | `[--skipAdminInit]` | mục dưới | 0; lỗi 1 |
| `schema snapshot` | `[-y] [--format json|yaml=yaml] [path]` | `getSnapshot`; ghi file (hỏi ghi đè) hoặc stdout | 0; lỗi 1 |
| `schema apply` | `[-y] [-d|--dry-run] [--ignoreRules <csv>] <path>` | mục dưới | 0; lỗi 1 |
| `--help`, `--version` | — | commander; `backoffice [command] [options]`, phiên bản Backoffice | 0 |

Trước khi khai báo lệnh: `loadExtensions()` (port `load-extensions.ts`): bỏ qua khi không có `DB_CLIENT`, DB chưa cài,
hoặc `migrationsValid()` sai (log `Skipping CLI extensions initialization due to outstanding migrations.`); nếu nạp:
`getExtensionManager().initialize({ schedule: false, watch: false })`, rồi `emitter.emitInit('cli.before', { program })`;
sau khi khai báo: `emitInit('cli.after', { program })`. Lỗi không bắt: `console.error(err)` (eslint-disable như
Directus), mã 1.

## `bootstrap`

```text
Initializing bootstrap...
[chờ DB: tối đa 5 lần, 5 s; hết → validateDatabaseConnection → lỗi, mã 1]
[vendor ngoài Postgres/SQLite: DB trống → "Backoffice bootstraps only Postgres and SQLite databases; on <client> run
  "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)" mã 1; DB đã cài → "Database on <client> is migrated by
  Directus 11.17.4 (D-145); skipping migrations" → Done, mã 0]
DB trống:
  Installing Backoffice system tables...    (seed, 15 bảng)
  Running migrations...
  Applying <name>...                         × 101 (+ custom)
  Setting up first admin role...
  Adding first admin user...                 (chỉ khi ADMIN_EMAIL và ADMIN_PASSWORD)
  | Skipping creation of default Admin user and role...   (--skipAdminInit)
  [PROJECT_NAME → upsertSingleton({ project_name })]
  [PROJECT_OWNER là email → setOwner(...) (D-38: log cảnh báo, không gửi report); lần thứ hai, lần đầu nằm trong
    migration 20251014A-add-project-owner]
DB đã cài:
  Database already initialized, skipping install
  Running migrations...
  Applying <name>...                         (chỉ migration chưa chạy)
Done
```

Sau `latest` có áp ít nhất một migration: `flushCaches(true)` (bus Redis → mọi instance).

## `schema apply`

1. `validateDatabaseConnection`; chưa cài → log lỗi `Backoffice isn't installed on this database. Please run "backoffice
   bootstrap" first.`, mã **0** (như Directus).
2. Đọc yaml (`.yaml`/`.yml`) hoặc JSON; `getSnapshot` hiện tại; `getSnapshotDiff`; lọc `--ignoreRules`.
3. Không đổi → `No changes to apply.`, mã 0.
4. `--dry-run` hoặc không `-y`: in kế hoạch (`Collections:`, `Fields:`, `Relations:` với `Create`/`Update`/`Delete`,
   `Set <path> to <v>`, `Remove <path>`, `Add <path> and set it to <v>`, màu `chalk`); `--dry-run` → mã 0.
5. Không `-y`: hỏi `Do you want to continue?`; không → mã 0.
6. `applySnapshot` (port) → `Snapshot applied successfully`, mã 0; lỗi → mã 1.

## `init` (D-146, D-147)

- Câu 1 `Choose your database client`: `PostgreSQL / Redshift` | `SQLite` (Directus có 6).
- Không `npm install <driver>`, không spinner.
- Câu hỏi kết nối như `questions.ts`; `trySeed` tối đa 5 lần với thông báo của Directus.
- `.env` từ `env-stub.liquid` (Backoffice), `SECRET=nanoid(32)`, `DB_CLIENT` (`mysql2` → `mysql` không còn áp dụng), `DB_*`.
- Admin: email (mặc định `admin@example.com`, Joi), password (không rỗng), insert `directus_roles`, `directus_policies`,
  `directus_access`, `directus_users` với `randomUUID()` và `generateHash`.
- In: `Your project has been created at <dir>.`, `The configuration can be found in <dir>/.env`, `Start Backoffice by
  running:`, `  cd <dir>`, `  node cli.js start`.

## Thương hiệu (D-147, chuẩn hóa trong test)

| Chỗ | Directus | Backoffice |
|-----|----------|------------|
| `program.name` / usage | `directus [command] [options]` | `backoffice [command] [options]` |
| `--version` | `11.17.4` | `BACKOFFICE_VERSION` |
| mô tả `start`, `init` | `Start the Directus API`, `Create a new Directus Project` | `... Backoffice ...` |
| `init` cuối | `Start Directus by running:` / `npx directus start` | `Start Backoffice by running:` / `node cli.js start` |
| `.env` mẫu | chữ Directus, link docs.directus.io | chữ Backoffice, không link |
| `schema apply` chưa cài | `Directus isn't installed ... "directus bootstrap"` | `Backoffice isn't installed ... "backoffice bootstrap"` |
| log `bootstrap` (owner 2026-10-22) | `Installing Directus system tables...` | `Installing Backoffice system tables...` |
| giữ nguyên | `Database doesn't have Directus tables installed.`, `... do not match Directus 11.17.4`, tên bảng, biến, mã lỗi, tên lệnh | như Directus |

Bộ chuẩn hóa: đúng danh sách của spec FR-107 (không thêm quy tắc ở đây).

## Cổng vendor (D-145)

`assertBootstrapVendor(mode)` với `getDatabaseClient()`: `postgres`, `sqlite` → tiếp; mọi giá trị khác (gồm `redshift`)
→ log lỗi, `database.destroy()`:

| Lệnh | Thông điệp (spec FR-008, FR-026) | Mã |
|------|----------------------------------|----|
| `bootstrap`, DB trống | `Backoffice bootstraps only Postgres and SQLite databases; on <client> run "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)` (error) | 1 |
| `bootstrap`, DB đã cài | `Database on <client> is migrated by Directus 11.17.4 (D-145); skipping migrations` (info), `Done` | 0 |
| `database install`, `database migrate:*` | `Backoffice runs migrations only on Postgres and SQLite databases; on <client> use the Directus 11.17.4 image (D-145)` (error) | 1 |

`users`, `roles`, `cache`, `count`, `schema`, `security`, `start` không gác. `init` chỉ ghi `DB_CLIENT="pg"` hoặc
`"sqlite3"` nên không bao giờ tạo cấu hình bị chặn.

## DB cài dở, lỗi giữa chừng (spec FR-015)

Giống Directus: không transaction bao seed hay migration, không kiểm bảng thiếu. DB có `directus_collections` là "đã
cài"; `bootstrap` đi nhánh đã cài và lỗi ở migration đầu tiên chạm bảng thiếu (mã 1). Migration lỗi: hàng chưa ghi, lần
sau chạy lại. Phục hồi theo `deploy/README.md`.

## Bí mật (FR-016)

Không lệnh nào in giá trị `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `DB_PASSWORD`, `SECRET`, `KEY` ra stdout, stderr hay log,
kể cả trong lỗi kết nối DB (pino serialize lỗi Knex: không có cấu hình kết nối trong `err`; kiểm ở parity).
