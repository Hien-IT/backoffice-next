# Contract: test chấp nhận, kind và CI sau 026

## `pnpm nx run parity-tests:deploy` (compose mặc định, BE 3 replica + 1 Directus)

`instances.ts`:

- Bỏ `SEPARATE` và tham số `separate` của `composeArgs` (chỉ còn `standalone`).
- `directusUrl`: không đổi (`http://127.0.0.1:8095`; standalone → lb 8090).
- `lbUrl` → `directusLbUrl = 'http://127.0.0.1:8090'`: domain D qua lb (chỉ dùng ở các test không chạy standalone).
- `boLbUrl = STANDALONE ? 'http://127.0.0.1:8090' : 'http://127.0.0.1:8091'`: domain B qua lb.
- `BO_PUBLIC_URL = STANDALONE ? 'http://localhost:8090' : 'http://localhost:8091'`: giá trị `PUBLIC_URL` của bản Backoffice
  (`config.json`, `Location` TUS).
- `instanceUrls()`, `replicaUrl()`, `lbLog()`, `containerIp()`, `psql()`, `runContainer()`, `runDirectus()`: không đổi.

| File | Đổi | Kiểm (sau 026) | Spec |
|------|-----|----------------|------|
| `smoke.test.ts` | bỏ `skipIf(SEPARATE)`; `lbUrl` → `boLbUrl`; `config.json` = `BO_PUBLIC_URL` | 4 instance `pong`; health qua domain B; `config.json` | 019 FR-040, FR-043; 026 US1-1 |
| `compose.test.ts` | bỏ `skipIf(SEPARATE)`; case FR-041 so env: `backoffice-api` khác `directus` đúng `['PUBLIC_URL']`; case FR-050 → "spreads API requests over the BE replicas only" qua `boLbUrl` (mọi upstream là replica, ≥ 2 replica) + "the Directus domain reaches Directus only" qua `directusLbUrl`; case SPA/`/` redirect qua `boLbUrl`; case `X-Forwarded-For`: login qua `boLbUrl` → `directus_activity.ip` của BE, login qua `directusLbUrl` → của Directus (không còn vòng lặp "đợi rơi vào Directus"); scale, non-root, amd64 không đổi; describe standalone không đổi | US1-2, US1-3, US1-4; 019 FR-023, FR-025, FR-030, FR-042..FR-044, FR-051 | |
| `domains.test.ts` (đổi tên từ `separate-domain.test.ts`) | `skipIf(STANDALONE)`; `lbUrl` → `directusLbUrl` | `/admin/` của 8090 là Directus app, `config.json` của 8091; định tuyến theo cổng (50/20 request); `Location` TUS ở 8091; sửa ở một domain thấy ở domain kia (FR-073 của 019); `Set-Cookie` không `Domain`; env chỉ khác `PUBLIC_URL` (FR-071) | US1-1..3; 019 US9 (trừ SSO), FR-070..FR-075 |
| `sessions.test.ts`, `schema.test.ts`, `flows-schedule.test.ts`, `tus.test.ts` | bỏ `skipIf(SEPARATE)` | không đổi: gọi thẳng 3 replica + Directus (`instanceUrls`) | 019 US3–US5 |
| `shutdown.test.ts` | bỏ `skipIf(SEPARATE)`; tải `autocannon` qua `boLbUrl` | TERM một replica dưới tải qua domain B: 0 lỗi; mã 143 | 019 US6; SC-003 |
| `extensions.test.ts` | case D-137 "the app chunks go to the BE replicas only": bỏ phần đếm upstream, giữ phần nội dung chunk (bare specifier) lấy qua `boLbUrl`; `lbUrl` → `boLbUrl` | extension trên mọi node (`instanceUrls`); chunk ở domain B có bare specifier; cài qua registry | 020 US2 |
| `backoffice-permissions.test.ts` | case D-189.7: bỏ `skipIf(SEPARATE \|\| STANDALONE)`, đổi mô tả "answered by the BE at the Backoffice domain": `/permissions/me` có `import`, `export`; `/backoffice/permissions` 200 qua `boLbUrl`; Directus vẫn trả `/permissions/me` của nó (`directusUrl`, skip standalone) | 025 US6; 026 US2-2 (bản compose) | |
| `backoffice-migrations.test.ts`, `web-image.test.ts` | bỏ `skipIf(SEPARATE)` | không đổi | 022, 019 US8 |
| `image-swap.test.ts` | `skipIf(STANDALONE)` | không đổi: container gọi thẳng, không qua lb (Q7) | 019 US1 |
| `standalone.test.ts`, `global-setup.ts` | không đổi | | 021 |
| `instances.test.ts` | `composeArgs(['up'], '/tmp/e')` không có file override; standalone có `docker-compose.standalone.yml` | | |

Không còn test nào bị skip ở compose mặc định ngoài các describe standalone; ở `DEPLOY_MODE=standalone` các describe
dùng `directusLbUrl`, Directus hay `domains.test.ts` skip như cũ.

## `ci/test-template.sh`

- `base` thêm `--set domain.publicUrl=https://h.test`.
- Bỏ rendering `separate.yaml` và 4 check "separate domain: ..." (:58-61); bỏ "api Service selects the pool label only",
  "pool label on the api pods" (:39-40), "Ingress: /extensions/sources to api-only", "Ingress: /permissions/me ...",
  "api-only Service selects ..." (:52-55).
- Thêm: `shared: PUBLIC_URL on api and web only` (`count 'name: PUBLIC_URL'` = 2); `shared: the Backoffice URL`
  (`value: "https://h.test"`); `shared: no other env entry` (2 dòng `{ name: X, value: }`); `no pool label, no api-only
  Service` (`! grep api-pool`, `! grep bo-api-only`); `api Service selects the release pods`
  (`app.kubernetes.io/component: api` dưới `selector:` của `bo-api`); `Ingress: /admin to web, / to api, no other path`
  (đúng 2 `path:` trong `default.yaml`); `shared without domain.publicUrl fails` (`! helm template ... --set
  domain.publicUrl=`, thông báo chứa `domain.publicUrl`); `standalone: no PUBLIC_URL` (`count` = 0 trong `standalone.yaml`,
  render không có `domain.publicUrl`).
- `options.yaml`: `extraPaths` ví dụ đổi từ SAML sang một path trung lập (`/hook`, service `other`, port 80); check
  "extra path before /" giữ.
- NOTES: "NOTES shared: Directus bootstraps the database first" giữ; thêm "NOTES shared: own domain" (`Directus keeps its
  own domain`); "NOTES standalone: no Directus pool label" đổi thành `! grep -q PUBLIC_URL` (standalone không in
  domain).
- Phần FR-053/FR-076 trên chart giả (`fakeLookup`): giữ; `good` thêm `--set domain.publicUrl=https://h.test` (đã có trong
  `base`); thêm case: ConfigMap có `REFRESH_TOKEN_COOKIE_DOMAIN=other.test` → `helm template` dừng (trước đây chỉ khi
  có `domain.publicUrl`).

## `ci/kind-test.sh`

| Dòng (hiện tại) | 026 |
|-----------------|-----|
| :15 `api()` Host `cms.test` | `Host: backoffice.test` (domain B); thêm `cms()` Host `cms.test` không cần (Directus không có Ingress trong `deps.yaml`; gọi Directus qua port-forward 18055 như :97) |
| :44-46 routing | giữ, qua `backoffice.test`; thêm "Ingress /permissions/me, /backoffice/permissions, /extensions/sources/index.js -> api" (status 200/200/200, US2-2) |
| :48-56 patch nhãn pool + "bo-api has BE and Directus" | thay: ghi `generation` và `resourceVersion` của `deployment/directus` trước `helm install`, so sau khi cài: không đổi (SC-004); patch nhãn `backoffice.io/api-pool: bo` lên Directus (giả lập pod còn nhãn cũ, US2-3) rồi kiểm endpoints `bo-api` không chứa IP pod Directus |
| :57-64 `bo-api-only` | xóa |
| :66-87 tải khi rolling/HPA | giữ, qua `backoffice.test` (`load.mjs "$base" backoffice.test ...`); thêm sau tải: log Traefik không cần; kiểm "0 request tới Directus" bằng `kubectl exec deploy/directus -- wc -l` không khả thi → dùng endpoints (trên) làm bằng chứng |
| :89-111 extension 020 | `demo` qua Ingress chỉ tới pod BE; thêm `demo_directus()` = `curl 18055/parity-endpoint-demo` cho 200/404/200 (Directus vẫn nạp cùng bộ extension, 020 FR-040) |
| :126-136 FR-076 | bỏ `--set apiPool.name=bo2`; giữ phần còn lại |
| :138-151 FR-053 | bỏ `--set apiPool.name=bo3`; thêm `--set domain.publicUrl=http://bo3.test` |
| thêm trước `helm uninstall bo` | US3-1/SC-006: `helm upgrade bo "$chart" -f values-kind.yaml --set domain.publicUrl= --set ingress.host=cms.test` phải lỗi, thông báo chứa `domain.publicUrl`; `kubectl get deployment bo-api -o jsonpath='{.metadata.generation}'` không đổi |
| :155-219 standalone | không đổi |

## CI (`.github/workflows/ci.yml`)

| Job | 026 |
|-----|-----|
| `deploy` | bỏ bước `parity-tests:deploy` với `DEPLOY_MODE: separate-domain` (:431-433); comment đầu job: "the acceptance suite on deploy/compose with 3 BE replicas + 1 Directus on two domains, then the standalone mode"; bước `fresh environment`, standalone, logs, down không đổi (`--profile shared-only` là profile của override standalone) |
| `deploy-k8s` | không đổi (chạy `test-template.sh`, `kind-test.sh` mới) |
| `benchmark.yml` | không đổi (không dùng `deploy/compose`) |
