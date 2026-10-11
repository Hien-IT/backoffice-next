# Backoffice

API và app quản trị viết lại từ Directus 11.17.4, chạy song song với Directus trên cùng database, Redis và
storage. Mọi endpoint trả về giống Directus; khác biệt được chấp nhận ghi trong `specs/<feature>/spec.md`.

## Yêu cầu

- Node 22 (`.nvmrc`), pnpm 10 qua Corepack (`packageManager` trong `package.json`)
- Docker có Compose v2 (môi trường tham chiếu, test đối chiếu, benchmark)

```bash
corepack enable
```

```bash
pnpm install
```

## Lệnh thường dùng

| Việc | Lệnh |
| --- | --- |
| Build, lint, typecheck, test (kèm ngưỡng coverage) | `pnpm nx run-many -t build lint typecheck test` |
| Chỉ các project bị ảnh hưởng | `pnpm nx affected -t lint typecheck test build` |
| Chạy API | `pnpm nx build api` rồi `pnpm nx serve api` |
| Chạy app web (`/admin/`) | `pnpm nx serve web` |
| Test đối chiếu với Directus | `pnpm nx run parity-tests:env-up --vendor=postgres` rồi `pnpm nx run parity-tests:parity --vendor=postgres` |
| Benchmark | `pnpm nx run benchmark:env-up` rồi `pnpm nx run benchmark:run` |
| Benchmark auth (2.000 kết nối) | `pnpm nx run benchmark:env-up-auth` rồi `pnpm nx run benchmark:auth` |
| E2E web | `pnpm nx run web-e2e:e2e` |
| Kiểm tra quy tắc repo | `pnpm run check-port-headers`, `pnpm run check-package-names`, `pnpm run test:tools` |

Cách chạy API mới cạnh Directus bằng đúng cấu hình của Directus, và từng bước kiểm tra: xem
[`specs/001-platform-foundation/quickstart.md`](specs/001-platform-foundation/quickstart.md).

## Cấu trúc

- `apps/api`: NestJS 12, Knex, không ORM
- `apps/web`, `apps/web-e2e`: Vue 3, Pinia, Vue Router, vue-i18n; Playwright
- `libs/*`: thư viện port từ `directus/packages/*`, tên `@backoffice/*`
- `tests/parity`: chạy cùng request trên Directus và API mới rồi so kết quả; `tests/benchmark`: so hiệu năng
- `specs/`: spec, plan, tasks của từng feature; `.specify/memory/constitution.md`: các nguyên tắc của dự án

## Quy tắc

- **Không sửa `directus/`**: đây là mã nguồn tham chiếu, chỉ đọc. CI chặn PR có thay đổi dưới `directus/`
  (`tools/guard-directus-unchanged.mjs`).
- **Port file từ Directus**: dòng đầu file đích ghi `// Ported from directus/<đường dẫn nguồn>`, và ghi cặp
  nguồn→đích vào `tools/port-manifest/<task>.json`. `pnpm run check-port-headers` kiểm tra cả hai.
- **Tên package**: mọi package nội bộ tên `@backoffice/*`, không phụ thuộc `@directus/*` (trừ `@directus/sdk`).
- **Phiên bản thư viện**: ghim trong `catalog:` của `pnpm-workspace.yaml`, theo bản Directus 11.17.4; bản khác
  Directus phải ghi lý do trong Complexity Tracking của `plan.md`.
- Mỗi PR phải qua mọi job của `.github/workflows/ci.yml`.
