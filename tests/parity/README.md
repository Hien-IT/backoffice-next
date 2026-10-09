# Parity tests

So sánh response của Backoffice API với Directus 11.17.4 trên cùng database, Redis và storage (FR-101..105). Mỗi request
được gửi cho cả hai app; status, bộ header của FR-104 và body phải giống nhau, trừ các khác biệt được chấp nhận trong
[`accepted-differences.ts`](accepted-differences.ts).

## Chạy

```bash
pnpm nx run parity-tests:env-up --vendor=postgres
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres --output-style=static
```

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```

- `--vendor`: `postgres`, `postgres10`, `mysql`, `mysql5`, `maria`, `mssql`, `oracle`, `cockroachdb`, `sqlite3`. Đặt
  `TEST_DB` và thắng biến có sẵn. Mỗi vendor một compose project `parity-<vendor>`, cấu hình chung cho cả hai app ở
  `env/<vendor>.env`.
- `PARITY_SUITE=full` (mặc định): mọi file test. `PARITY_SUITE=reduced`: chỉ
  `src/server/{ping,health,info,errors,methods,conditional}.test.ts`, bỏ các ca cần dừng container hoặc profile riêng.
- Profile riêng (chỉ dùng ở `full`), bật bằng `env-up --profiles=ratelimit,cors-hsts,pressure,metrics`:

  | Profile     | Directus | Backoffice | Cấu hình                    |
  | ----------- | -------- | ---------- | --------------------------- |
  | (chính)     | 8155     | 8156       | `env/<vendor>.env`          |
  | `ratelimit` | 8255     | 8256       | `env/profile-ratelimit.env` |
  | `cors-hsts` | 8355     | 8356       | `env/profile-cors-hsts.env` |
  | `pressure`  | 8455     | 8456       | `env/profile-pressure.env`  |
  | `metrics`   | 8555     | 8556       | `env/profile-metrics.env`   |

  Database dùng cổng host 6100–6107, Redis 6108, MinIO 8881.

- Chạy một file: `pnpm nx run parity-tests:parity --vendor=postgres -- src/server/info.test.ts`.
- So với một API đang chạy ngoài Docker: đặt `BACKOFFICE_URL` (hoặc `DIRECTUS_URL`) trước khi chạy.
- Unit test của chính bộ so sánh (không cần Docker): `pnpm nx test parity-tests`.

Image Directus chỉ có bản amd64; trên máy arm64 nó chạy giả lập nên chậm, các ca phụ thuộc thời gian dùng `parityStable`
để thử lại.

## Đọc báo cáo

Khi khác, test báo endpoint, vị trí (status, header hoặc JSON pointer), giá trị của Directus và của API mới, ví dụ:

```text
GET /server/info: 1 unaccepted difference(s)
  body /project/project_color
    Directus:   "#6644FF"
    Backoffice: "#000000"
```

## Thêm khác biệt được chấp nhận

1. Thêm dòng vào bảng "Khác biệt so với Directus" trong `specs/<feature>-*/spec.md` (mã `D-xx`, lý do, cột "Gỡ khi" nếu
   là tạm thời).
2. Thêm mục vào `accepted-differences.ts` với cùng `id`, `feature` là số của spec đó, `removeAt` khớp cột "Gỡ khi".
   - `kind: 'http'`: khác biệt trong response; khai báo `endpoints` (`'GET /path'`, `'* /path'`, tiền tố `'/path/*'`
     hoặc `'*'`), `location` (`{ status: true }`, `{ header }`, `{ jsonPointer }` chuỗi hoặc RegExp, `{ any: true }`),
     giá trị hai bên (`directus`, `backoffice`) và `when` nếu chỉ áp dụng khi Directus trả status hoặc mã lỗi nhất định.
   - `kind: 'doc'`: khác biệt ngoài HTTP (log, package, migration, khởi động); bộ so sánh bỏ qua.
3. `src/accepted-differences.test.ts` kiểm tra mỗi mục có trong bảng của đúng spec, `removeAt` khớp, và fail khi spec
   của feature `removeAt` đã `Status: Done` mà mục vẫn còn: lúc đó xoá mục và sửa API cho giống Directus.
