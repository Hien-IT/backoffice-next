# Implementation Plan: Chạy độc lập (khởi tạo DB, migration và CLI giống Directus 11.17.4)

**Branch**: `021-standalone-init-cli` (trên `main`, không có branch riêng) | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-standalone-init-cli/spec.md`

## Summary

Thêm vào `apps/api` bản port nguyên văn của CLI Directus (`directus/api/src/cli`), bộ seed (15 yaml + `seeds/run.ts`) và
101 migration hệ thống (+ `migrations/run.ts`), để image Backoffice khởi động như image Directus (`bootstrap` rồi
`start`) và tự khởi tạo, nâng cấp DB trên Postgres và SQLite; các vendor khác vẫn do Directus khởi tạo (D-145). Thêm chế
độ triển khai độc lập: compose override với service `bootstrap` chạy một lần, Helm `mode: standalone` với Job
`pre-install`/`pre-upgrade` và ConfigMap custom migration; chế độ chung của 019 giữ nguyên (replica khởi động như container
Directus, clarify Q1). Test: profile parity `bootstrap` (hai DB trống, một do Directus, một do Backoffice bootstrap; so
schema, hàng hệ thống, `directus_migrations`; Directus khởi động trên DB của Backoffice; migrate chéo; từng lệnh CLI),
deploy standalone trên compose và kind.

Cách làm (chi tiết ở [research.md](./research.md)):

- CLI gọi service bằng `new Service({ schema, knex })` như Directus, không dùng Nest context; `apps/api/cli.js` ở gốc
  package → `/directus/cli.js` trong image, CMD `node cli.js bootstrap && exec node cli.js start` dưới `tini` (R1, R2).
- Seed yaml và `env-stub.liquid` copy vào `dist` bằng `cpSync` trong script build (tiền lệ `libs/system-data`, R3).
- 101 migration chép nguyên văn, chỉ đổi 9 specifier import; test máy kiểm "nguyên văn" bằng cách so với bản gốc sau khi
  áp bảng thay thế (R4). Bốn thứ nhỏ còn thiếu: `processChunk`, hai type `SettingsModuleBar*`, `uuid`, type `Migration`.
- Cổng vendor D-145 (gồm `redshift`) ở lệnh CLI, không sửa `run.ts`; DB cài dở và lỗi giữa chừng làm giống Directus,
  chỉ có tài liệu phục hồi (R5).
- Thương hiệu: `backoffice`, phiên bản Backoffice, `node cli.js start`; dòng nêu bảng/phiên bản Directus giữ (R7).
- Kết quả checklist `pre-tasks.md` (R15): owner report qua registry giả của parity, dump mọi bảng sau khi app healthy,
  chuẩn hóa theo spec FR-107, kiểm bí mật trong log, Job `parallelism: 1` cùng `securityContext`, kiểm
  `MIGRATIONS_PATH` khi mount ConfigMap, NOTES nhắc `helm upgrade` và điều kiện trước của chế độ chung.

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23; swc
build; Dockerfile, compose YAML (override với `profiles`, `!reset`), Helm template, POSIX `sh`.

**Primary Dependencies**: có sẵn: NestJS 12 (không dùng cho CLI), Knex 3.1, `pg`, `sqlite3`, `@backoffice/{env,types,
utils,schema,constants,format-title}`, `fs-extra`, `js-yaml` 4.3.2, `joi` 18.2.6, `nanoid` 5.1.16, `zod` 4.1.12,
`lodash-es`, `knex-mock-client` (test). Thêm (bản của catalog Directus 11.17.4): `commander` 14.0.2, `inquirer` 12.11.0,
`chalk` 5.6.2, `liquidjs` 10.25.7, `uuid` 11.1.0 (đã có trong catalog gốc). Không thêm `ora`, `execa` (D-146),
`copyfiles` (R3), `@types/inquirer`. Image: `directus/directus:11.17.4` (test), `node:22.23.3-alpine3.24` + `tini`
(không đổi).

**Storage**: bảng hệ thống `directus_*` do seed tạo và 101 migration sửa, giống Directus 11.17.4; `directus_migrations`
ghi `{ version, name }`; không bảng, cột, khóa Redis mới. Redis: `flushCaches(true)` sau migration, cùng kênh bus của
002/004/005.

**Testing**: Vitest unit (`apps/api`: `migrations/run.test.ts` port 8 test, `migrations/port.test.ts`, `seeds/run.test.ts`,
test từng lệnh với `knex-mock-client`, `cli/index.test.ts` cây lệnh); parity profile `bootstrap`
(`tests/parity/src/bootstrap/{schema,cross,cli,init}.test.ts`, Postgres + SQLite, mỗi PR); deploy
`DEPLOY_MODE=standalone` (`parity-tests:deploy`); kind standalone (`deploy-k8s`); `check-port-headers` với manifest
theo task `tools/port-manifest/021-T###.json`.

**Target Platform**: Linux `amd64` container (image API), Docker Compose v2 (≥ 2.24 cho `!reset`), Kubernetes ≥ 1.29.

**Project Type**: BE (`apps/api`) + đóng gói (`deploy/`) + test (`tests/parity`).

**Performance Goals**: `docker run` không env trả `/server/ping` dưới 60 s (SC-007); bootstrap Postgres trống (seed +
101 migration + admin) dưới 60 s [Unverified: đo ở lượt 1]; không đổi hiệu năng API (code `start` không đổi).

**Constraints**: không sửa `directus/`; migration và seed nguyên văn (II); không biến env mới (VIII; `PROJECT_OWNER` là
biến Directus chuyển từ "không áp dụng" sang "hỗ trợ"); không lock cho `bootstrap` (chủ dự án); chỉ Postgres và SQLite
bootstrap (D-145); làm trên `main`, phối hợp push với các phiên khác; chạy test local từng file, `--maxWorkers=1`.

**Scale/Scope**: ~101 + 15 + 25 file mới trong `apps/api` (migration, seed, cli, 4 util/type), ~8 file sửa (`package.json`,
`Dockerfile`, `supported-variables.ts`, `validate-migrations.ts`, `libs/utils`, `libs/types`, catalog, manifest); test:
~8 file parity mới, 4 file deploy sửa/mới, 1 fixture migrations; deploy: 1 override compose, 1 lb conf, 2 template Helm
mới, 4 sửa, 2 script CI sửa; docs: README deploy, README parity, 3 spec cũ, `accepted-differences.ts`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.* (constitution v3.0.0)

- [x] I. Không sửa `directus/`; mọi file port (cli, seeds, migrations, `apply-snapshot`, `process-chunk`, type) có
  `// Ported from ...` dòng 1 và nằm trong `tools/port-manifest/021-*.json`; yaml dùng `# Ported from`.
- [x] II. Seed và 101 migration là bản port nguyên văn (test `port.test.ts`, `seeds/run.test.ts` so với bản gốc);
  `bootstrap`/`migrate` chỉ chạy trên Postgres và SQLite (D-145); không bảng, cột, migration riêng; DB do Backoffice tạo
  dùng được với Directus (profile `bootstrap`: Directus khởi động, đăng nhập, migrate chéo); kiểm tra `directus_migrations`
  lúc `start` giữ nguyên 001.
- [x] III. Không đổi REST/GraphQL. CLI có cùng lệnh, option, exit code, log (D-147 chỉ thương hiệu).
- [x] IV. `flushCaches(true)` sau migration xóa cache mọi instance qua bus chung; `cache clear` dùng `clearSystemCache`
  và Keyv chung; không state trong process (CLI thoát bằng `process.exit`).
- [x] V. Parity: profile `bootstrap` so schema, hàng, `directus_migrations`, từng lệnh CLI (FR-100..FR-102); deploy
  standalone compose + kind (FR-103, FR-104); unit cho `run.ts`, seed, danh sách migration (FR-105).
- [x] VI. Không app Nx mới; `apps/api/src/cli` theo cây Directus; service là class thường như Directus (R1); Knex.
- [x] VII. Chế độ độc lập: `bootstrap` chạy một lần (compose service một lần, Helm Job `pre-install`/`pre-upgrade`),
  replica chỉ `start`; chế độ chung: replica khởi động như container Directus (ngoại lệ `bootstrap` của 3.0.0, Q1);
  `start` vẫn chỉ đọc; SIGTERM không đổi; cache trong process không đổi.
- [x] VIII. Không biến mới; `PROJECT_OWNER` vào danh sách hỗ trợ (biến Directus, cùng tên và ý nghĩa); chế độ độc lập đọc
  cùng `.env`/ConfigMap/Secret định dạng Directus; chart không khai báo biến (giữ FR-046 của 019).
- [x] IX. Đổi: tên chương trình, phiên bản, mô tả `start`/`init`, thông báo `init`, `.env` mẫu, thông báo "isn't
  installed" (D-147); giữ: tên bảng, biến, mã lỗi, dòng nêu bảng/phiên bản Directus, tên lệnh.
- [x] X. Coverage ≥ 80% kể cả `cli`, `seeds`, `migrations/run.ts` (test từng lệnh với mock + parity); 101 migration loại
  khỏi mẫu số coverage với lý do (spec FR-106: bản chép máy kiểm, chạy thật ở parity), tech lead duyệt cùng bảng khác
  biệt; không gửi email (D-38 giữ, cả lần `setOwner` trong migration `20251014A`); khác biệt D-145..D-147 và các sửa
  D-19/D-121/D-123/D-141 trong spec: duyệt (chủ dự án kiêm tech lead, 2026-10-22).
- [x] XI. Không chạm SAML, email, websocket, storage ngoài Local/S3; khi chạy độc lập các mục này không có (spec ghi).
- [x] XII. Không có màn hình mới (không áp dụng).

**Re-check sau Phase 1**: không đổi. Hai điểm cần theo dõi khi làm: (a) `image-swap.test.ts` của 019 "DB trống thì
dừng" đổi thành "DB trống thì bootstrap" (II 3.0.0); (b) kiểm tra Helm `standalone` bỏ phần cookie domain (chỉ cho chế độ
chung) nhưng giữ FR-053/FR-045 (VII).

## Project Structure

### Documentation (this feature)

```text
specs/021-standalone-init-cli/
├── plan.md
├── research.md            # R1–R14
├── data-model.md          # directus_migrations, migration file, seed, lệnh CLI, chế độ triển khai, Job
├── quickstart.md
├── contracts/
│   ├── cli.md             # cây lệnh, option, exit code, thông báo, thương hiệu, cổng vendor
│   ├── migrations.md      # run.ts, quy tắc file, bảng specifier, seed, build, kiểm tra
│   ├── deploy.md          # image CMD, compose standalone, Helm values/Job/ConfigMap/checks
│   └── tests.md           # profile bootstrap, harness CLI, deploy standalone, kind, CI, ba lượt
├── checklists/requirements.md
└── tasks.md               # /speckit.tasks
```

### Source Code (repository root)

```text
apps/api/
├── cli.js                                   # mới: #!/usr/bin/env node; import('./dist/cli/run.js'); vào files, bin
├── package.json                             # sửa: build + cpSync yaml/liquid; deps commander, inquirer, chalk, liquidjs, uuid
├── Dockerfile                               # sửa: CMD sh -c "node cli.js bootstrap && exec node cli.js start"; mkdir dist/migrations
└── src/
    ├── cli/                                 # port directus/api/src/cli
    │   ├── index.ts                         # createCli (commander), tên backoffice, version Backoffice
    │   ├── run.ts                           # createCli().then(parseAsync).catch(console.error, exit 1)
    │   ├── load-extensions.ts               # migrationsValid() boolean, initialize({schedule:false, watch:false})
    │   ├── commands/
    │   │   ├── start.ts                     # mới: như main.ts
    │   │   ├── bootstrap/index.ts           # + assertBootstrapVendor (D-145)
    │   │   ├── database/{install,migrate}.ts
    │   │   ├── users/{create,passwd}.ts, roles/create.ts, cache/clear.ts, count/index.ts
    │   │   ├── schema/{snapshot,apply}.ts, security/{key,secret}.ts
    │   │   └── init/{index,questions}.ts    # drivers chỉ pg, sqlite3; không execa/ora (D-146)
    │   └── utils/
    │       ├── assert-vendor.ts             # mới: cổng Postgres/SQLite (D-145, gồm redshift)
    │       ├── drivers.ts, create-db-connection.ts
    │       └── create-env/{index.ts,env-stub.liquid}
    ├── database/
    │   ├── seeds/{run.ts,run.test.ts,01-collections.yaml … 15-migrations.yaml}
    │   ├── migrations/{run.ts,run.test.ts,port.test.ts,20201028A-… .ts × 101}   # cạnh directus-11.17.4.ts
    │   └── validate-migrations.ts           # sửa: + migrationsValid()
    ├── types/migration.ts                   # mới
    ├── utils/apply-snapshot.ts              # mới (port)
    └── config/supported-variables.ts        # sửa: PROJECT_OWNER hỗ trợ
libs/
├── utils/src/shared/process-chunk.ts        # mới (port), re-export
└── types/src/settings.ts                    # + SettingsModuleBarLink, SettingsModuleBarModule
pnpm-workspace.yaml                          # catalog: commander, inquirer, chalk, liquidjs
tools/port-manifest/021-T###.json                # một manifest cho mỗi task tạo file port
deploy/
├── README.md                                # sửa: Thay image, Lệnh CLI; mới: Chạy độc lập
├── compose/
│   ├── docker-compose.standalone.yml        # mới: tắt directus, service bootstrap, command start, lb standalone
│   └── lb/standalone.conf                   # mới
└── helm/backoffice/
    ├── values.yaml                          # + mode, bootstrap.*, migrations.configMap
    ├── templates/bootstrap-job.yaml         # mới (standalone)
    ├── templates/{api-deployment.yaml,_checks.tpl,NOTES.txt}   # sửa
    └── ci/{test-template.sh,kind-test.sh,deps-standalone.yaml,values-kind-standalone.yaml}
tests/parity/
├── docker-compose.yml                       # + postgres-bootstrap, directus-bootstrap, backoffice-api-bootstrap, directus-on-backoffice-db
├── env/{profile-bootstrap-postgres,profile-bootstrap-sqlite3}.env
├── fixtures/migrations/{ok,collide,nodash,noup,fail}/*.js
├── scripts/env.mjs, src/docker.ts, src/config.ts, src/suite.ts     # + profile bootstrap, cổng
├── registry/server.mjs                      # sửa: đếm owner report theo project_owner
├── src/global-setup.ts                       # sửa: chụp baseline của profile bootstrap
├── src/bootstrap/{baseline,dump,normalize,cli}.ts, {schema,cross,partial,cli,init,vendor}.test.ts
├── src/deploy/{instances.ts,smoke,compose,image-swap}.test.ts       # sửa; standalone.test.ts mới
├── accepted-differences.ts                  # D-19, D-141 sửa chữ; D-145..D-147 doc (feature 021)
└── README.md
specs/{001,019,020}-*/spec.md                # dòng D-19, D-121, D-123, D-141, US1/FR-024/FR-042 trỏ 021
.github/workflows/ci.yml                     # parity profiles + bootstrap; deploy standalone; docker: node cli.js --version
```

**Structure Decision**: giữ cây `directus/api/src/{cli,database/seeds,database/migrations}` để port nguyên văn và so
test; không project Nx mới; test deploy và parity ở `tests/parity` như 019/020.

## Complexity Tracking

Không có vi phạm. Ngoại lệ "chế độ chung: replica khởi động như container Directus" đã nằm trong Nguyên tắc VII
(3.0.0, clarify Q1), không cần dòng ở đây.
