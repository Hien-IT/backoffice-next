# Contract: bộ đối chiếu, blackbox, lịch, CI, E2E, benchmark (009)

Mẫu theo contracts/parity.md của 008. Mọi test mới chạy với cả hai app trên cùng DB (Nguyên tắc V).

## 1. Môi trường đối chiếu

| Thay đổi | Nội dung |
|----------|----------|
| `proxy/backoffice-routes.txt` | thêm `flows`, `operations` (`flows` bao `/flows/trigger/...`) |
| profile `flows-schedule` (cặp mới, cổng 10355/10356, thủ công) | `env/profile-flows-schedule.env`: `CACHE_NAMESPACE=parity-flows-schedule`, `REDIS_BUS_NAMESPACE=parity-flows-schedule:bus`, `REDIS_LOCK_NAMESPACE=parity-flows-schedule:lock`, `SYNCHRONIZATION_STORE=redis`, `SYNCHRONIZATION_NAMESPACE=parity-flows-schedule:sync`, `FLOWS_ENV_ALLOW_LIST=FLOWS_SCHEDULE_HOOK_NAME`, `LOG_LEVEL=info`; compose `environment:` `FLOWS_SCHEDULE_HOOK_NAME=directus` ở `directus-flows-schedule`, `=backoffice` ở `backoffice-api-flows-schedule` (tiền lệ `CACHE_NAMESPACE` của `schema-cache`). **Thủ công** (`manualProfiles`): chỉ `schedule.test.ts` bật/tắt qua `profileUp`/`profileStop`; không vào `--profiles` của CI (`vendors.test.ts` kiểm). Đăng ký ở `config.ts profilePorts`, `docker.ts compose()`, `scripts/env.mjs ALL_PROFILES` |
| cặp `cache-mem` (005) | thêm vào `--profiles` của job `parity-blackbox` (ci.yml, parity-matrix.yml, nightly.yml, ci-local.sh) cho blackbox `webhook.test.ts` |
| cặp chính | không đổi; bộ đối chiếu gửi `Cache-Control: no-store` như 005 |
| `request-set.ts` | thêm `GET /flows`, `GET /operations`, `POST /flows` bị từ chối (public) cho `db-unchanged` |
| `server/errors.test.ts` | bỏ `/flows` khỏi ca `404` D-09.* |

## 2. Thư mục `tests/parity/src/flows/`

| File | Suite | Nội dung |
|------|-------|----------|
| `helpers.ts` | — | `same()` với `withoutD097`; `seedFlow(app, {flow, operations})` tạo qua API của `app` (hoặc cặp) và đợi app kia nạp lại (poll `GET /flows/:id` ở app kia tới 5 s); `runWebhook(app, method, id, body?, query?)`; `flowEffects(fn)` = `historyEffects` + dòng mới của collection đích, `directus_notifications`; `comparable()` thêm: `data.data.$env` bỏ, `data.steps[].operation` → `<op:i>`, `headers` của kết quả `request` chỉ giữ `content-type`; `cleanupFlows(ids)` |
| `crud.test.ts` | `reduced`, `full` | FR-001 đến FR-004: `POST` (đơn, mảng, lồng `operations`), `GET`, `SEARCH` (`keys`, `query`), `GET /:pk`, `PATCH` (`keys`, `query`, lồng `create/update/delete` + `operation` như `flow.vue`), `PATCH /operations` mảng gỡ `resolve`, `DELETE` (`resolve`/`reject` về null, operation xóa CASCADE), `fields` (`operations.*`, `flow.*`), `meta`, quyền user thường (`403`), `OPTIONS`, `HEAD`, uuid sai `/trigger` → `404`; R-22 (user không có delete: `403` và operation mất liên kết, đo trên Directus) |
| `webhook.test.ts` | `reduced`, `full` | US1 ca 1–4, 7: `GET` mặc định `$last`, `$all` (so sau khi bỏ `$env`), `return` đường dẫn, `POST` tới flow `GET` → `403`, `async` → `204` + log chạy xuất hiện, `error_on_reject` với `throw-error` (status, code, message) và với `$last` không phải `Error` (`500`), `cacheEnabled` chỉ qua header `Cache-Control`, flow `inactive` → `403`, flow `operation` → `403`, public (không token) chạy được |
| `manual.test.ts` | `reduced`, `full` | US1 ca 5, 6: body của `use-flows.ts` (`{collection, keys, ...fields}`, `{collection}` khi `requireSelection=false`), 6 lỗi `403` theo thứ tự, non-admin có/không quyền đọc, `keys` không đọc được, `keys` số và chuỗi, `async` |
| `event.test.ts` | `reduced`, `full` | US3: scope × collections (`articles`, `directus_users`, `directus_files`, `directus_comments`); filter: reject chặn request với lỗi của `throw-error`, `return` đổi payload (`transform`), `item-create` trong transaction bị rollback khi request lỗi; action: đợi hiệu ứng (`item-create` vào collection khác, poll ≤ 5 s), `$trigger` meta (`event`, `keys`, `collection`), `$accountability` của request; `auth.login` action; chỉ app nhận request chạy (đếm activity `run`) |
| `operations.test.ts` | `reduced` (ca resolve), `full` | US4: mỗi operation một flow webhook `POST` `return = $all`, ca resolve và reject theo contracts/operations.md; `item-*` với 4 dạng `permissions` (role test của 004); `request` tới `http://directus:8055/server/ping`, `/server/info`, `/server/nope` (lỗi HTTP), host không tồn tại (lỗi mạng), IP bị chặn; `trigger` ba `iterationMode` + flow đích không có; `exec` timeout và bộ nhớ (cặp chính dùng mặc định 32 MB, 10 s: script `while(true){}` → timeout); `mail` (D-34, kết quả `null`); `notification` (dòng DB, D-33); `json-web-token` ba thao tác; type lạ → `unknown` |
| `logs.test.ts` | `reduced`, `full` | US6: activity `run` + revision cho webhook (public và admin: `user`, `ip`, `user_agent`, `origin`), manual, event filter/action, schedule (từ `schedule.test.ts`); `accountability` `activity`, null; redaction (`headers.authorization`, `payload.password`, giá trị `$env` → `--redacted:KEY--`, cặp chính đặt `FLOWS_ENV_ALLOW_LIST` cho một biến test trong `env/<vendor>.env`); lỗi reject serialize (`name`, `message`; R7); log sidebar query của `use-revisions.ts`; D-34 và D-33 qua `logs()` container |
| `reload.test.ts` | `reduced`, `full` | US5, FR-062, SC-005: tạo ở A → kích hoạt ở B (≤ 2 s); sửa operation ở B → kết quả mới ở A; tắt ở A → `403` ở B; xóa; ghi qua `/items/directus_flows` và `/operations` cũng nạp lại; `GET /flows` ở hai app giống nhau sau mỗi bước |
| `schedule.test.ts` | `full` | US2, SC-004 trên cặp `flows-schedule`: seed flow `*/2 * * * * *` với `log` `flow-executed-on-{{ $env.FLOWS_SCHEDULE_HOOK_NAME }}` (port của `schedule-hook.seed.ts`), đợi 10 s: tổng dòng log hai container = 5, số dòng activity `run` mới = 5 (lặp 3 lượt); cron sai → warn, không chạy; dừng một app → app kia chạy đủ; tắt flow ở cặp chính không ảnh hưởng (namespace bus khác) rồi xóa qua cặp chính ở `afterAll` |
| `e2e-app.test.ts` | `full` | đúng chuỗi request của `flow.vue saveChanges` (`PATCH /operations` mảng, `PATCH /flows/:pk` lồng), `flow-drawer.vue` (`POST /flows?fields=id`), `overview.vue` (`PATCH {status}`, `DELETE`), `stores/flows.ts` (`GET /flows?fields[]=*&fields[]=operations.*&limit=-1`), `use-flows.ts` (`POST /flows/trigger/:id`), `logs-sidebar-detail.vue` → `use-revisions.ts` (`GET /revisions` với filter `activity.action = run`, `aggregate count`); so response |

`REDUCED_FILES` thêm `src/flows/{crud,webhook,manual,event,operations,logs,reload}.test.ts`; `FULL_FILES` thêm
`src/flows/**/*.test.ts`. `reduced` chạy MySQL, SQLite mỗi lần push; `full` Postgres mỗi lần push, vendor còn lại
nightly.

## 3. Blackbox

| File | Sửa |
|------|-----|
| `tests/db/routes/flows/webhook.test.ts` | copy; thay khối `spawn`/`getPort`/`awaitDirectusConnection` bằng `env[vendor]['URL'] = nodeUrl('cache-mem', 1)`, `describe.skipIf(!hasProfile('cache-mem'))`; giữ ba flow, operation `exec`, hai lần gọi cách 100 ms, so bằng/khác |
| `common/config.ts` | `nodeUrl` thêm `'cache-mem'`; `hasProfile` |
| `sequencer.ts` | `AFTER` thêm `tests/db/routes/flows/webhook.test.ts` như Directus |
| `tests/common/flows/schedule-hook.{seed,test}.ts` | không copy (ba process, stdout); phép đo tương đương ở `src/flows/schedule.test.ts` (§2) |

Chạy hai lượt (`PARITY_BLACKBOX_APPS=directus,backoffice`) với `cache-mem` trong `--profiles`.

## 4. CI

| Workflow | Thay đổi |
|----------|----------|
| `ci.yml` `quality` | `pnpm install` build isolated-vm (native); coverage 80% gồm file mới; `exec/index.test.ts` chạy thật |
| `ci.yml` `parity` | suite `flows` qua `suite.ts`; KHÔNG thêm `flows-schedule` vào `--profiles` |
| `ci.yml` `parity-blackbox`, `parity-matrix.yml` `blackbox-full`, `nightly.yml`, `ci-local.sh` | thêm `cache-mem` vào `--profiles` |
| `ci.yml` `docker` | image build isolated-vm trong stage builder (alpine `python3 py3-setuptools build-base` đã có); smoke: `node -e "require('isolated-vm')"` trong image |
| `benchmark.yml` | job `benchmark-flows` (cùng mẫu `benchmark-history`) |
| E2E job | `flows.spec.ts` |
| `guard-differences` | D-09.7, D-26, D-29 xóa; D-31 thu hẹp; D-33 bỏ `removeAt`; D-34 thêm — ở commit đóng feature |

## 5. Playwright (`tests/directus-app-e2e/src/flows.spec.ts`)

| Kịch bản | Bước |
|----------|------|
| Tạo flow | Settings → Flows → "+" → tên, trigger Manual, collection `posts`, Save → trình chỉnh sửa: thêm operation Transform (`{"ok": true}`) nối resolve, thêm Log (`{{ $last }}`), Save (`PATCH /flows/:pk` lồng) |
| Chạy trên item | mở item `posts` → menu Flows → chạy → thông báo thành công; Logs sidebar của flow có 1 lần chạy với 2 bước resolve |
| Chạy trên danh sách | chọn 2 item → chạy → Logs có thêm lần chạy với `keys` 2 phần tử |
| Tắt, xóa | overview: toggle status → nút Flows trên item biến mất; xóa flow → `directus_operations` của nó biến mất |

`/flows`, `/operations`, `/revisions`, `/activity`, `/items` qua proxy tới app mới. `bothRuns` so `directus_flows`,
`directus_operations`, `directus_activity` (`run`), `directus_revisions` sau chuẩn hóa id, thời điểm, `steps[].operation`.

## 6. Benchmark (`tests/benchmark/src/flows.ts`)

| Kịch bản | Request |
|----------|---------|
| `webhook-sync` | `POST /flows/trigger/:id` với body nhỏ; flow `transform` → `condition` → `item-read` (1 item), `return = $last`, `accountability: null` |
| `flows-list` | `GET /flows?fields[]=*&fields[]=operations.*&limit=-1` (admin; seed 50 flow × 3 operation) |
| `webhook-exec` (không chặn, chỉ ghi số) | `POST /flows/trigger/:id` với flow `exec` trả `{ok: true}` |

Seed `seed-flows.ts`: collection 1.000 item, 50 flow. 50 kết nối, 3 vòng, ngưỡng 10% p95 và req/s (trừ
`webhook-exec`); chạy hằng tuần, không chặn CI.
