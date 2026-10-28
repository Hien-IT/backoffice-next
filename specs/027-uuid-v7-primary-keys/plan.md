# Implementation Plan: Khóa chính uuid tự sinh dùng UUID v7

**Branch**: `027-uuid-v7-primary-keys` (trên `main`, không có branch riêng; script `.specify` cần
`SPECIFY_FEATURE=027-uuid-v7-primary-keys`) | **Date**: 2026-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/027-uuid-v7-primary-keys/spec.md`

## Summary

Khi tạo item ở collection người dùng qua API Backoffice, field có special `uuid` không có giá trị nhận UUID v7 (tăng dần
theo thứ tự sinh trong một process) thay cho v4 của Directus; collection hệ thống giữ v4, giá trị client gửi giữ nguyên,
item lồng theo collection của chính nó (D-192, constitution 3.4.0 Nguyên tắc II). Lý do: chuẩn bị phân trang dạng con
trỏ ở feature sau. Không bảng, cột, migration, biến môi trường, dependency mới; Directus 11.17.4 không đổi.

Cách làm (chi tiết ở [research.md](./research.md)): một chỗ sửa trong bản port PayloadService: transformer `uuid` thành
arrow function đọc `this.collection`, gọi `v7()` của gói `uuid` 11.1.0 đã có cho collection người dùng và giữ
`randomUUID()` cho collection hệ thống theo `isSystemCollection` của `@backoffice/system-data` (R1–R3); mọi đường tạo item
(REST, singleton, GraphQL, import, flow, extension, item lồng) đi qua `ItemsService.createOne` nên không sửa chỗ khác
(R4); thứ tự sắp theo vendor: Postgres 16 và SQLite đã đo đúng thứ tự tạo, MSSQL `uniqueidentifier` không theo thứ tự tạo,
vendor khác kiểm ở CI (R5); validator không đổi (R6); test đối chiếu file mới + case flow + D-192 `doc` (R7); unit test,
chi phí bộ sinh đo riêng (R8); một lượt (R10).

## Technical Context

**Language/Version**: TypeScript 5.9.3 strict (cờ của `@directus/tsconfig`), Node.js 22 LTS, ESM, pnpm 10.27, Nx 23;
swc build cho `apps/api`.

**Primary Dependencies**: có sẵn, không thêm: `uuid` 11.1.0 (`v7()`, đã là dependency chạy của `apps/api` cho migration
port `20250613A`), `node:crypto` (`randomUUID()`), `@backoffice/system-data` (`isSystemCollection`), NestJS 12, Knex 3.1;
test: Vitest 3.2.4, `knex-mock-client`, `@backoffice/schema-builder`.

**Storage**: không bảng, cột, migration, dòng `directus_*` mới; giá trị ghi vào cột uuid có sẵn của collection người dùng
(`uuid` trên Postgres và CockroachDB, `char(36)` trên MySQL, MariaDB, SQLite, Oracle, `uniqueidentifier` trên MSSQL;
R5). Không Redis key, cache hay bus mới.

**Testing**: Vitest unit (`apps/api/src/services/payload.service.test.ts`); parity env chính
(`tests/parity/src/items/uuid-v7.test.ts` mới ở bộ `reduced` và `full`, case `item-create` ở
`flows/operations.test.ts`, D-192 `doc` ở `accepted-differences.ts`); PR CI chạy Postgres (full), MySQL và SQLite
(reduced); `nightly.yml` (chạy tay) cho MariaDB, MSSQL, Oracle, CockroachDB, Postgres 10; benchmark-items hiện có
(SC-007). Không E2E: không đổi giao diện.

**Target Platform**: Linux `amd64` container (API).

**Project Type**: BE (`apps/api`) + test (`tests/parity`).

**Performance Goals**: `v7()` khoảng 0,23 micro giây mỗi id so với 0,03 của `randomUUID()` (đo 2026-10-29, research
"Kết quả đo"), nhỏ so với một request ghi DB [Inference]; scenario benchmark hiện có không tệ hơn Directus quá 10 %
(SC-007, Nguyên tắc X).

**Constraints**: không sửa `directus/` (I); dữ liệu ghi theo ngoại lệ UUID v7 của Nguyên tắc II (3.4.0), collection hệ
thống giữ v4; API/GraphQL giống Directus trừ giá trị id tự sinh (III, D-192); không biến env mới (VIII); comment code ghi
"DR" (IX); coverage BE ≥ 80 % (X).

**Scale/Scope**: API 1 file sửa (`services/payload.service.ts`: 2 import, transformer `uuid`) + unit test; parity 1 file
mới (`items/uuid-v7.test.ts`) + 3 file sửa (`flows/operations.test.ts`, `accepted-differences.ts`, `src/suite.ts`) +
README; docs: spec 027 (R11), `CLAUDE.md`, `SPECKIT-GUIDE.md`; D-192.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.4.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. PASS: không file nào trong `directus/` đổi; `payload.service.ts` giữ header nguồn
  (`// Ported from directus/api/src/services/payload.ts`) và ghi comment `// Backoffice (spec 027, D-192)` tại chỗ sửa.
- [x] II. PASS theo ngoại lệ 3.4.0: field special `uuid` của collection người dùng nhận UUID v7 khi API tự sinh; collection
  hệ thống (`isSystemCollection`: `directus_*`, `backoffice_*` trong danh sách) giữ v4, kể cả field người dùng thêm vào;
  giá trị client gửi giữ nguyên; không DDL, không migration; DB dùng được với Directus 11.17.4 (cùng dạng chuỗi; Directus
  tự ghi v7 vào `project_id`, R6).
- [x] III. PASS với D-192 ghi trong spec (duyệt 2026-10-29 sau plan và checklist api-compat): path, query, response, status, header, cookie, schema
  GraphQL, OAS không đổi; chỉ giá trị id tự sinh ở collection người dùng khác (ký tự version, thứ tự).
- [x] IV. PASS: trạng thái mới trong process chỉ là mốc và bộ đếm của `v7()` (module `uuid`), không quan trọng: mất khi
  khởi động lại chỉ làm thứ tự bắt đầu lại theo đồng hồ; id duy nhất giữa replica nhờ phần ngẫu nhiên (R2); không lock,
  không bus, không Redis key mới.
- [x] V. PASS: parity `items/uuid-v7.test.ts` (Backoffice v7, Directus v4, đọc ghi chéo, collection hệ thống v4, invite
  với role do Backoffice tạo, thứ tự sắp theo vendor), case flow `item-create`, D-192 `doc`; test có sẵn không đổi (R7).
- [x] VI. PASS: không service, provider, project hay lib mới; sửa trong bản port PayloadService.
- [x] VII. PASS: không ảnh hưởng khởi động, cấu hình FE, storage; nhiều replica sinh id không trùng; thứ tự giữa replica
  theo đồng hồ, ghi là giới hạn (FR-011).
- [x] VIII. PASS: không biến môi trường mới (luôn bật, clarify).
- [x] IX. PASS: không chuỗi mới cho người dùng; comment ghi "DR".
- [x] X. PASS: unit test giữ coverage; hiệu năng đo riêng (R8) và benchmark-items hiện có; log, metrics, email không đổi;
  D-192 trong spec.
- [x] XI. PASS: không chạm mục ngoài phạm vi; phân trang con trỏ ngoài phạm vi 027.
- [x] XII. PASS (không áp dụng): không đổi FE.

Post-design re-check (sau Phase 1): không đổi; "Sửa spec khi plan" (research R11) là câu chữ của bảng hiện trạng, FR-011,
Edge Cases, SC-007, áp vào spec cùng commit plan.

## Project Structure

### Documentation (this feature)

```text
specs/027-uuid-v7-primary-keys/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (R1–R11, kết quả đo)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output: api.md, tests.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
apps/api/src/services/
├── payload.service.ts                                          # transformer uuid: arrow function, v7 cho collection người dùng, v4 cho hệ thống (R1–R3)
└── payload.service.test.ts                                     # case uuid (contracts/tests.md)
tests/parity/
├── accepted-differences.ts                                     # D-192 (doc, feature 027)
├── README.md                                                   # mục "Test items": file mới
└── src/
    ├── suite.ts                                                # + items/uuid-v7.test.ts (reduced, full)
    ├── items/uuid-v7.test.ts (mới)                             # R7, contracts/tests.md
    └── flows/operations.test.ts                                # item-create: phiên bản id theo app
specs/027-uuid-v7-primary-keys/spec.md                          # câu chữ R11, duyệt D-192
CLAUDE.md, SPECKIT-GUIDE.md                                     # 027
```

**Structure Decision**: không project Nx mới, không lib mới; chỗ sửa là bản port PayloadService (lớp service, nơi DR sinh
giá trị cho special `uuid`); test đối chiếu ở `tests/parity` như 023, 024.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Không có vi phạm: dữ liệu ghi theo ngoại lệ của Nguyên tắc II (constitution 3.4.0, chủ dự án duyệt 2026-10-29); D-192 là
khác biệt API ghi trong spec theo Nguyên tắc X.
