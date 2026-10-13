# Quickstart: kiểm tra flows (009)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo. `pnpm install` build
isolated-vm (native, cần Python 3 và toolchain C++; trên macOS arm64 build được, trên CI alpine đã có
`python3 py3-setuptools build-base`).

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api @backoffice/utils @backoffice/errors @backoffice/types
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app,assets-limit,assets-stress
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

Cặp `flows-schedule` do `schedule.test.ts` tự bật và tắt; không đưa vào `--profiles` (cặp dùng chung DB, chạy flow
mỗi 2 giây).

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america,assets-limit,assets-stress,cache-mem
```

```bash
pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

```bash
pnpm nx run directus-app-e2e:e2e
```

## 2. Kiểm tay: cùng flow, cùng kết quả ở hai app

1. Mở app Directus qua proxy (`http://localhost:8160/admin`), Settings → Flows → tạo flow trigger Webhook (`POST`),
   thêm operation Transform `{"hello": "{{ $trigger.body.name }}"}`, Save (`/flows`, `/operations` đi tới app mới).
2. Gọi hai app với cùng body:

```bash
curl -s -X POST http://localhost:8156/flows/trigger/<id> -H 'Content-Type: application/json' -d '{"name":"A"}'
```

```bash
curl -s -X POST http://localhost:8155/flows/trigger/<id> -H 'Content-Type: application/json' -d '{"name":"A"}'
```

Kỳ vọng: cả hai trả `{"data":{"hello":"A"}}`; Logs sidebar của flow trong app Directus có hai lần chạy, mỗi lần một
bước resolve với option đã thay thế.

## 3. Kiểm tay: sửa ở app này, app kia nạp lại

Đổi operation Transform thành `{"hello": "{{ $trigger.body.name }}!"}` trong app Directus (lưu qua app mới); gọi lại
Directus (8155) ngay: kỳ vọng `"A!"` mà không khởi động lại (bus kênh `flows`). Ngược lại: `PATCH /operations/<id>`
thẳng vào Directus rồi gọi app mới.

## 4. Kiểm tay: flow theo lịch chạy một lần mỗi kỳ

Đặt trong `.env` dùng chung `SYNCHRONIZATION_STORE=redis` (cùng `SYNCHRONIZATION_NAMESPACE` ở hai app); tạo flow
trigger Schedule `*/5 * * * * *` với operation Log `tick`; khởi động lại hai app.

```bash
docker compose -p parity-postgres logs -f directus backoffice-api | grep tick
```

Kỳ vọng: mỗi 5 giây đúng một dòng `tick` (ở app này hoặc app kia); `redis-cli monitor` thấy một `setGreaterThan`
thành công mỗi kỳ trên key `directus-sync:clock:<flow id>:*/5 * * * * *`. Với `SYNCHRONIZATION_STORE=memory` cả hai
app đều ghi `tick` mỗi kỳ, và app mới cảnh báo `Backoffice: SYNCHRONIZATION_STORE is not redis; scheduled flows run
on every instance` lúc nạp.

## 5. Kiểm tay: Run Script và mail

- Operation Run Script `module.exports = async function(data) { return data.$trigger.body; }` trả body; `while
  (true) {}` trả lỗi `Script execution timed out.` sau `FLOWS_RUN_SCRIPT_TIMEOUT` (mặc định 10 s) ở nhánh reject.
- Operation Send Email: kết quả `null`, log app mới có dòng `Backoffice: mail sending is out of scope; flow mail
  "<subject>" to <to> not sent` (D-34); không có email nào được gửi ở cả hai app của môi trường đối chiếu.
