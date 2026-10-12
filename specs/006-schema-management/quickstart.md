# Quickstart: kiểm tra quản lý data model (006)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api utils types
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america
```

```bash
pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

```bash
BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e
```

- Dòng 1: unit test (coverage 80%), gồm test port từ Directus (`collections`, `fields`, `fields/*`, `schema`,
  `get-snapshot`, `get-snapshot-diff`, `apply-diff`, `validate-snapshot`, `validate-diff`, `sanitize-schema`,
  `get-versioned-hash`, `add-field-flag`, `readable-stream-to-string`) và test mới (`relations.service`, bốn controller,
  `flushCaches`, `router-options`).
- Dòng 2, 3: môi trường đối chiếu chính và bộ `full`, nay có `src/schema-management/{crud,ddl,relations,cross-use,
  sync-api}.test.ts` (`sync-api` cần profile `multi`) và phần `blackbox-common` thêm. `ddl`, `relations` chạy nối
  tiếp trên cùng DB: Directus trước, app mới sau, cùng tên collection (`parity_sm_*`).
- Dòng 4, 5: bộ blackbox (005 + 8 file của 006), hai lượt `backoffice` rồi `directus`; bốn profile mới cho
  `schema-cache.test.ts` (hai cặp) và hai file timezone đổi `TZ` (hai cặp). Chạy sau dòng 3 (seed thêm admin, xem
  quickstart 005). `PARITY_BLACKBOX_SETUP_APP=backoffice` để seed bằng app mới (lượt hằng tuần, FR-064);
  `PARITY_BLACKBOX_PK_TYPES=integer` cho bộ rút gọn.
- Dòng 6: Playwright qua proxy (profile `app` ở dòng 2), nay có `data-model.spec.ts`.

Vendor khác: `--vendor=mysql`, `sqlite3` (rút gọn mỗi lần push; đủ ở `parity-matrix.yml` và `blackbox-full`);
`maria`, `mssql`, `oracle`, `cockroachdb`, `postgres10`, `mysql5` ở `nightly.yml`.

## 2. Kiểm tay (US3, tiêu chí chấp nhận)

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8156/collections -H 'content-type: application/json' -d '{"collection":"demo_articles","schema":{},"meta":{"icon":"article"},"fields":[{"field":"id","type":"integer","schema":{"is_primary_key":true,"has_auto_increment":true},"meta":{"hidden":true}},{"field":"title","type":"string","meta":{"interface":"input"}}]}'
```

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8155/schema/snapshot > /tmp/snap-directus.json; curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://127.0.0.1:8156/schema/snapshot > /tmp/snap-backoffice.json; diff /tmp/snap-directus.json /tmp/snap-backoffice.json && echo SAME
```

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -X POST http://127.0.0.1:8155/schema/diff -H 'content-type: application/json' -d @/tmp/snap-backoffice.json -o /dev/null -w '%{http_code}\n'
```

- Dòng 1: tạo collection ở app mới (8156). Mở `http://127.0.0.1:8160/admin/settings/data-model/demo_articles` (app
  Directus qua proxy) và `/admin/content/demo_articles`: thấy collection, tạo được item.
- Dòng 2: snapshot ở Directus (8155) và app mới giống hệt. Dòng 3: `204`.
- Làm ngược: tạo ở 8155, mở ở app mới qua `GET /collections/demo_articles`, `GET /fields/demo_articles`,
  `POST /items/demo_articles` ở 8156.

## 3. Benchmark (hằng tuần, chỉ Postgres)

```bash
pnpm nx run benchmark:schema
```

Seed 200 collection qua API của Directus (vài phút), rồi đo năm kịch bản (admin, user; tươi, `HIT`); kết quả so với
ngưỡng 10% bằng `compare.ts`.

## 4. Đóng feature

- Chạy đủ ba vendor (Postgres, MySQL, SQLite) bộ blackbox đủ; xóa entry `D-09.4` khỏi `accepted-differences.ts`;
  sửa spec 001, 004, 005; constitution 1.4.0; `graphify update .`; tech lead duyệt bảng khác biệt.
