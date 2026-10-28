---

description: "Danh sách task cho feature 026: Backoffice chạy cạnh Directus chỉ ở domain riêng"
---

# Tasks: Backoffice chạy cạnh Directus chỉ ở domain riêng (bỏ chế độ chung domain của 019)

**Input**: Tài liệu thiết kế trong `/specs/026-separate-domain-only/`
**Prerequisites**: `plan.md`, `spec.md` (Q1–Q7 chốt 2026-10-28, FR-001..FR-015, SC-001..SC-007). Dùng thêm `research.md`
(R1–R10, bảng FR-015 ở R7), `data-model.md`, `contracts/` (`compose.md`, `helm-values.md`, `tests.md`), `quickstart.md`,
`checklists/requirements.md`, `checklists/deploy.md`.

**Điều kiện bắt đầu**: spec, plan, checklist 026 đã commit lên `main` (`ff626a1e`). Làm trên `main`, không branch; script
`.specify` cần `SPECIFY_FEATURE=026-separate-domain-only`. Checkout dùng chung với các phiên khác: `git add` theo đường
dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`, `clean`; không stage `apps/api/project.json`,
`apps/web/project.json`; trước khi push hỏi phiên "Speckit mở rộng cho spec 022" và chờ OK, push khi `main` không có run
CI đang chạy, rồi gửi số run cho phiên 021 nếu phiên đó còn chạy. Không sửa file dưới `directus/`. Không đổi code
`apps/*`, `libs/*`, image (plan). Máy local: không dừng container của phiên khác (project compose của bộ deploy là
`bo-deploy`, cổng 8090, 8091, 8095).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Không endpoint nào thêm hay đổi: không có parity test mới (plan, Constitution Check V). Bộ test của feature là
  `pnpm nx run parity-tests:deploy` (compose mặc định, BE 3 replica + 1 Directus, hai domain; lượt
  `DEPLOY_MODE=standalone`), `deploy/helm/backoffice/ci/test-template.sh`, `deploy/helm/backoffice/ci/kind-test.sh`;
  CI `deploy` (2 lượt), `deploy-k8s`.
- Test sửa trước (đỏ trên cấu hình cũ) rồi sửa compose/chart; mỗi case mới đối chiếu `contracts/tests.md`.
- Khác biệt mới so với Directus phát sinh khi làm: dừng, ghi vào spec, hỏi chủ dự án (Nguyên tắc X). FR-015: dòng
  "Gỡ" chạm `apps/*` phát hiện khi làm → dừng, hỏi chủ dự án.

**Organization**: Task nhóm theo user story, xếp theo hai lượt commit: **Lượt 1** = Phase 1 (setup), 2 (nền: helper test),
3 (US1 compose, bộ test deploy, `accepted-differences.ts`, job CI `deploy`); **Lượt 2** = Phase 4 (US2 Helm, kind,
template), 5 (US3 nâng cấp, tài liệu chuyển đổi), 6 (Polish: ghi chú spec cũ, `CLAUDE.md`, `SPECKIT-GUIDE.md`). Mỗi lượt
kết thúc bằng task "đóng lượt" (lint, test, deploy test, commit, push khi `main` rảnh, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt: `compose/` = `deploy/compose/`; `chart/` = `deploy/helm/backoffice/`; `deploy/` (test) =
  `tests/parity/src/deploy/`.
- Comment trong compose, conf, chart, test ghi Directus là "DR" chỉ ở `apps/web`, `apps/api` (constitution IX); các file
  của `deploy/` và `tests/` giữ "Directus" như 019–021. Mỗi file sửa ghi "Spec 026 (FR-xxx)" ở comment đầu phần đổi.

---

## Phase 1: Setup (lượt 1)

**Purpose**: công cụ và image để chạy bộ test deploy local.

- [ ] T001 Kiểm công cụ local và ghi "Kết quả T001" vào `specs/026-separate-domain-only/research.md`: `docker compose
      version` ≥ 2.24.4 (`!override`, `!reset`), `helm version` 4.3.x, `kubeconform`, `kind` (có thì chạy kind local,
      không thì chỉ CI); build image `hiennd23/backoffice-{api,web}:local` (`pnpm nx run-many -t container -p api web`
      hoặc tag sẵn có qua `BACKOFFICE_TAG`); xác nhận không có project `bo-deploy` của phiên khác đang chạy
      (`docker compose -p bo-deploy ps`).

---

## Phase 2: Foundational (lượt 1)

**Purpose**: helper chung của mọi test deploy; chặn mọi task test phía sau.

- [ ] T002 Sửa `tests/parity/src/deploy/instances.ts` theo `contracts/tests.md`: bỏ `SEPARATE`; `composeArgs(args,
      envFile = ENV_FILE, standalone = STANDALONE)` không còn file override domain riêng; `lbUrl` → `directusLbUrl =
      'http://127.0.0.1:8090'` (domain D qua lb, không dùng ở standalone); thêm `boLbUrl = STANDALONE ? 'http://127.0.0.1:8090'
      : 'http://127.0.0.1:8091'` và `BO_PUBLIC_URL = STANDALONE ? 'http://localhost:8090' : 'http://localhost:8091'`; comment
      đầu file nêu spec 026 FR-005; `directusUrl`, `instanceUrls`, `replicaUrl`, `lbLog`, `containerIp`, `psql`,
      `runContainer`, `runDirectus` giữ nguyên.
- [ ] T003 Sửa `tests/parity/src/deploy/instances.test.ts`: `composeArgs(['up'], '/tmp/e')` không chứa file override;
      `composeArgs(['up'], '/tmp/e', true)` chứa `docker-compose.standalone.yml`; `boLbUrl`/`BO_PUBLIC_URL` theo
      `DEPLOY_MODE`; chạy `pnpm vitest run -c tests/parity/vitest.deploy.config.ts src/deploy/instances.test.ts` (file này
      không cần compose; nếu config kéo `globalSetup` thì chạy qua `npx vitest run --root tests/parity
      src/deploy/instances.test.ts --globalSetup false` hoặc tách config như 019 đã làm — ghi cách chạy vào research).

**Checkpoint**: `instances.ts` compile; các test khác chưa sửa đỏ ở `tsc` vì thiếu `SEPARATE`/`lbUrl` (đúng ý: T007–T013
sửa chúng).

---

## Phase 3: User Story 1 — Compose dev dựng Directus và Backoffice ở hai domain bằng một lệnh (Priority: P1) (lượt 1)

**Goal**: `docker compose up -d --wait` không override dựng Directus ở 8090 (Directus app ở `/admin`), Backoffice ở 8091
(`/admin` FE, còn lại chỉ replica BE); env chỉ khác `PUBLIC_URL`; standalone không đổi (FR-001..FR-005, FR-009, FR-011,
FR-012, SC-001..SC-003, SC-005).

**Independent Test**: `pnpm nx run parity-tests:deploy` xanh (gồm `domains.test.ts`), `DEPLOY_MODE=standalone` xanh; log
lb: cổng 8081 chỉ IP replica, cổng 8080 chỉ IP Directus (`quickstart.md` §1, §2).

### Compose

- [ ] T004 [US1] `compose/docker-compose.yml` theo `contracts/compose.md`: `lb.ports` = `'8090:8080'`, `'8091:8081'`;
      `lb.volumes` = `./lb/shared.conf:/etc/nginx/conf.d/default.conf:ro`; `backoffice-api.environment.PUBLIC_URL` và
      `backoffice-web.environment.PUBLIC_URL` = `http://localhost:8091`; chú thích đầu file (dòng 1–12) viết lại: hai
      domain, cổng 8090 (Directus, `/admin` của Directus), 8091 (Backoffice: `/admin` → FE, còn lại → replica BE), 8095,
      "only PUBLIC_URL differs for the Backoffice services (spec 026 FR-003, Principle VIII 3.3.0)"; `git mv
      compose/lb/separate-domain.conf compose/lb/shared.conf` và sửa chú thích đầu file (`shared` = next to Directus,
      spec 026 FR-001, FR-002; bỏ các "see shared-domain.conf" :9, :14, :44 → chép câu giải thích ngắn tại chỗ);
      `git rm compose/lb/shared-domain.conf compose/docker-compose.separate-domain.yml`.
- [ ] T005 [P] [US1] `compose/docker-compose.standalone.yml`: thêm `lb.ports: !override ['8090:8080']`,
      `backoffice-api.environment: !reset`, `backoffice-web.environment: !reset` với comment "Spec 026 (FR-011): the
      default file sets PUBLIC_URL of the Backoffice domain; standalone has no Directus, Backoffice stays at 8090 with the
      PUBLIC_URL of .env"; `compose/lb/standalone.conf` dòng 1–2 trỏ `shared.conf` thay `shared-domain.conf`. Kiểm:
      `docker compose -f docker-compose.yml -f docker-compose.standalone.yml config` không có `PUBLIC_URL` trong
      `environment` của hai service Backoffice, `lb.ports` chỉ 8090; `... -f docker-compose.shared-extensions.yml config`
      hợp lệ (Assumptions).

### Bộ test deploy (mỗi file một task, song song sau T002)

- [ ] T006 [P] [US1] `deploy/smoke.test.ts`: bỏ `skipIf(SEPARATE)`; health qua `boLbUrl`; `config.json` = `{ apiUrl:
      BO_PUBLIC_URL }`; comment đầu file "the default environment (spec 026)".
- [ ] T007 [P] [US1] `deploy/compose.test.ts` theo `contracts/tests.md`: bỏ `skipIf(SEPARATE)`; case FR-041 thành "gives
      the BE the Directus env with only PUBLIC_URL changed": khóa khác nhau giữa `backoffice-api.environment` và
      `directus.environment` đúng `['PUBLIC_URL']`, giá trị `http://localhost:8091` (cả `backoffice-web`); case FR-050 →
      "spreads API requests over the BE replicas only" (100 request `boLbUrl/server/info`: mọi upstream là IP replica, ≥ 2
      replica) + "sends the Directus domain to Directus only" (20 request `directusLbUrl/server/info`: upstream = IP
      Directus; `skipIf(STANDALONE)`); case `/admin` và `/` → `boLbUrl`; case X-Forwarded-For: một login qua `boLbUrl`
      (ip của dòng activity mới nhất = `203.0.113.9`, upstream là replica) và một qua `directusLbUrl` (`skipIf(STANDALONE)`),
      bỏ vòng lặp chờ "rơi vào Directus"; describe standalone không đổi.
- [ ] T008 [P] [US1] `git mv deploy/separate-domain.test.ts deploy/domains.test.ts`: `describe.skipIf(STANDALONE)('one
      domain per app')`; `lbUrl` → `directusLbUrl`; bỏ `SEPARATE`; comment đầu file: spec 026 US1 (FR-001..FR-003), 019 US9;
      các case giữ (Directus app ở 8090, `config.json` 8091, định tuyến theo cổng, `Location` TUS, FR-073, cookie không
      `Domain`, env chỉ `PUBLIC_URL`).
- [ ] T009 [P] [US1] `deploy/shutdown.test.ts`: bỏ `skipIf(SEPARATE)`; `autocannon` `url: boLbUrl`; comment "load through the
      Backoffice domain (spec 026 SC-003)".
- [ ] T010 [P] [US1] `deploy/sessions.test.ts`, `deploy/schema.test.ts`, `deploy/flows-schedule.test.ts`, `deploy/tus.test.ts`,
      `deploy/backoffice-migrations.test.ts`, `deploy/web-image.test.ts`: bỏ import và `skipIf(SEPARATE)` (describe không
      skip ở mặc định); `deploy/image-swap.test.ts`: `describe.skipIf(STANDALONE)`, comment "Q7 of spec 026: the swapped
      service serves the Backoffice domain; this test calls the container directly".
- [ ] T011 [P] [US1] `deploy/extensions.test.ts`: case "the app chunks go to the BE replicas only (D-137)" → "the app chunks
      at the Backoffice domain keep bare specifiers (D-137)": `api(boLbUrl, 'GET', '/extensions/sources/index.js')` 200 và
      nội dung như case cũ; bỏ phần đếm upstream và `skipIf(SEPARATE)`; `lbUrl` → `boLbUrl` ở các chỗ còn lại.
- [ ] T012 [P] [US1] `deploy/backoffice-permissions.test.ts`: case D-189.7 → `it('answers /permissions/me with import and
      export and /backoffice/permissions at the Backoffice domain (spec 026 FR-009)')`: qua `boLbUrl` 200 cho
      `/permissions/me` (body có `import`, `export`) và `/backoffice/permissions`; bỏ `skipIf(SEPARATE || STANDALONE)`;
      Directus vẫn trả `/permissions/me` của nó (`directusUrl`, `skipIf(STANDALONE)`); comment đầu file bỏ "D-189.7".
- [ ] T013 [P] [US1] `tests/parity/accepted-differences.ts` dòng D-189.7: `reason: 'Removed by spec 026: next to Directus,
      Backoffice is on its own domain and every path of that domain reaches the BE (no lb or Ingress route).'` (giữ `id`,
      `kind: 'doc'`); chạy `pnpm nx run parity-tests:lint` nếu target có, hoặc `pnpm vitest run` test của
      `accepted-differences` nếu có (`grep -rl accepted-differences tests/parity/src --include=*.test.ts`).

### CI

- [ ] T014 [US1] `.github/workflows/ci.yml` job `deploy`: xóa bước `parity-tests:deploy` với `DEPLOY_MODE: separate-domain`
      (:431-433); comment đầu job (:410-411) → "the acceptance suite on deploy/compose with 3 BE replicas + 1 Directus on
      two domains (spec 026), then the standalone mode"; các bước còn lại giữ.

### Chạy local

- [ ] T015 [US1] Chạy `BACKOFFICE_TAG=local pnpm nx run parity-tests:deploy` (dựng mới; nếu env `bo-deploy` cũ còn thì
      `docker compose -p bo-deploy --env-file .env.deploy-test --profile extensions-test down -v --remove-orphans` trước)
      và `DEPLOY_MODE=standalone BACKOFFICE_TAG=local pnpm nx run parity-tests:deploy` (sau bước `down -v`); sửa cho xanh;
      ghi "Kết quả T015" (số test, thời gian, lỗi đã sửa) vào `research.md`.

### Đóng lượt 1

- [ ] T016 Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p parity-tests`; `docker compose config` ba tổ hợp (mặc định,
      standalone, shared-extensions) hợp lệ; `git add` theo đường dẫn (`deploy/compose`, `tests/parity/src/deploy`,
      `tests/parity/accepted-differences.ts`, `.github/workflows/ci.yml`, `specs/026-separate-domain-only/research.md`,
      `tasks.md`); commit `feat(026): compose next to Directus on two domains by default, deploy suite on that layout`;
      hỏi phiên "Speckit mở rộng cho spec 022", push khi `main` rảnh, gửi số run cho phiên 021; CI xanh (`deploy` 2 lượt,
      `deploy-k8s` vẫn xanh vì chart chưa đổi); `graphify update .`; ghi số run vào `research.md`.

**Checkpoint**: US1 dùng được: máy dev hai domain, bộ test deploy xanh trên CI.

---

## Phase 4: User Story 2 — Helm chart cạnh Directus chỉ phục vụ domain Backoffice (Priority: P1) (lượt 2)

**Goal**: `mode: shared` bắt buộc `domain.publicUrl`, Service `-api` chỉ chọn pod BE của release, Ingress một host B, không
nhãn pool, không `-api-only`, kiểm cookie mọi lần, chart không chạm Directus (FR-006..FR-010, SC-004, SC-006).

**Independent Test**: `chart/ci/test-template.sh` xanh; kind (`chart/ci/kind-test.sh`) xanh: routing ở `backoffice.test`,
Directus `generation` không đổi, pod còn nhãn cũ không có trong endpoints, FR-076, FR-053 (`quickstart.md` §3).

### Values và template

- [ ] T017 [US2] `chart/values.yaml` theo `contracts/helm-values.md`: xóa khối `apiPool` (:49-52); comment `mode` (:4-8)
      thêm "`shared` = next to Directus (shared DB, Redis, storage) on its own domain (spec 026)"; comment `ingress.host`
      (:76) → "Required: the Backoffice domain (next to Directus it is NOT the Directus domain, spec 026 FR-007)"; comment
      `extraPaths` (:81) → "Paths routed before /admin and /, to another Service of the namespace (never Directus: spec
      026 FR-001)"; `domain.publicUrl` (:83-85) → "Required in mode shared (spec 026 FR-003): PUBLIC_URL of the Backoffice
      domain, the only variable set apart from the Directus env; ignored in standalone (021 FR-083)"; `git rm
      chart/values-separate-domain.yaml`.
- [ ] T018 [P] [US2] `chart/templates/_helpers.tpl`: xóa `backoffice.pool` (:3); `chart/templates/api-deployment.yaml`: xóa
      dòng nhãn `backoffice.io/api-pool` (:25); `chart/templates/api-service.yaml`: comment :10 → "The BE pods of this
      release only (spec 026 FR-006): Directus never joins the pool", `selector` = `{{- include "backoffice.selector"
      (dict "Release" .Release "component" "api") | nindent 4 }}`; `git rm chart/templates/api-only-service.yaml`.
- [ ] T019 [P] [US2] `chart/templates/ingress.yaml`: xóa ba path `/extensions/sources`, `/permissions/me`, `/backoffice`
      (:31-45) và comment của chúng; còn `extraPaths` → `/admin` → `/`; `chart/templates/NOTES.txt`: dòng 1 → "Backoffice
      {{ .Chart.AppVersion }} on {{ .Values.ingress.host }}: /admin -> <release>-web, the rest -> <release>-api."; nhánh
      `shared` (:9-18) → "PUBLIC_URL={{ .Values.domain.publicUrl }} for the Backoffice pods; Directus keeps its own domain
      and /admin (spec 026). The database must be bootstrapped by Directus before Backoffice pods start (shared mode)."
      (bỏ hướng dẫn gắn nhãn pool); nhánh standalone không đổi.
- [ ] T020 [US2] `chart/templates/_checks.tpl` theo `contracts/helm-values.md`: (1) ngay sau kiểm `mode` (:12-14) thêm
      `{{- if and (eq .Values.mode "shared") (not .Values.domain.publicUrl) -}}{{- fail "domain.publicUrl is empty: next to
      Directus (mode: shared) Backoffice runs on its own domain. Set domain.publicUrl (https://backoffice.example.com) and
      ingress.host (backoffice.example.com); upgrading a shared-domain release of 019: see \"Chuyển từ chung domain sang
      domain riêng\" in deploy/README.md." -}}{{- end -}}` (trước `lookup`, FR-006); (2) kiểm cookie (:43-54): điều kiện
      `{{- if ne .Values.mode "standalone" -}}`, `$host := .Values.ingress.host | default (urlParse
      .Values.domain.publicUrl).host` (FR-008); (3) comment đầu file (:1-9) nêu spec 026: "next to Directus the Backoffice
      domain is required and the cookie check runs on every install/upgrade"; FR-053 giữ nguyên.

### Kiểm template và kind

- [ ] T021 [US2] `chart/ci/test-template.sh` theo `contracts/tests.md` "ci/test-template.sh": `base` thêm `--set
      domain.publicUrl=https://h.test`; xóa rendering `separate.yaml` (:23, vòng `for` :29) và check :34, :39-40, :52,
      :54-55, :57-61, :138; `options.yaml` `extraPaths` ví dụ `/hook` → service `other` port 80; thêm check: "shared:
      PUBLIC_URL on api and web only" (= 2), "shared: the Backoffice URL" (`value: "https://h.test"`), "shared: no other env
      entry" (= 2), "no pool label, no api-only Service", "api Service selects the release pods", "Ingress: /admin to web,
      / to api, no other path" (2 `path:` trong `default.yaml`), "shared without domain.publicUrl fails" (`! helm template
      ... --set domain.publicUrl=` và thông báo chứa `domain.publicUrl`), "standalone: no PUBLIC_URL" (= 0, render không
      `domain.publicUrl`), "NOTES shared: own domain" (`Directus keeps its own domain`); "NOTES standalone: ..." :86 →
      `! grep -q PUBLIC_URL`; chart giả `fakeLookup`: thêm case ConfigMap `REFRESH_TOKEN_COOKIE_DOMAIN=other.test` →
      `helm template` (với `base`) dừng và thông báo chứa `h.test`; chạy `chart/ci/test-template.sh` local xanh.
- [ ] T022 [US2] `chart/ci/values-kind.yaml`: `ingress.host: backoffice.test`, thêm `domain.publicUrl: http://backoffice.test`;
      `chart/ci/kind-test.sh` theo `contracts/tests.md` "ci/kind-test.sh": `api()` Host `backoffice.test` (:15); comment
      :44 "Routing (spec 026 FR-002)"; sau :46 thêm ba curl 200 cho `/permissions/me` (với token: dời xuống sau khi có
      `$token`), `/backoffice/permissions`, `/extensions/sources/index.js` (US2-2); thay :48-56 bằng: ghi
      `gen_before=$(kubectl get deployment directus -o jsonpath='{.metadata.generation}')` TRƯỚC `helm install bo` (:37)
      và so sau khi cài (SC-004); giữ `kubectl patch` nhãn `backoffice.io/api-pool: bo` (:50) với comment "US2 scenario 3:
      a Directus pod still carrying the old label gets no request" rồi assert endpoints `bo-api` KHÔNG chứa IP pod
      Directus (`kubectl get pods -l app=directus -o jsonpath='{.items[0].status.podIP}'`); xóa khối `bo-api-only`
      (:57-64); `load.mjs "$base" backoffice.test ...` (:73); extension 020 (:89-111): `demo` giữ (chỉ pod BE qua Ingress),
      thêm `demo_directus() { [ "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:18055/parity-endpoint-demo)" =
      "$1" ]; }` kiểm 200/404/200 cùng lúc (020 FR-040 giữ; port-forward :97 dời lên trước); FR-076 (:128-129) bỏ `--set
      apiPool.name=bo2`; FR-053 (:141-142) bỏ `--set apiPool.name=bo3`, thêm `--set domain.publicUrl=http://bo3.test`;
      phần standalone (:155-219) không đổi.
- [ ] T023 [US2] Chạy kind local nếu T001 có `kind` (`kind create cluster --name bo-deploy`, build/tag image `:ci`,
      `KIND_CLUSTER=bo-deploy chart/ci/kind-test.sh`, `kind delete cluster --name bo-deploy`), không thì để CI `deploy-k8s`
      ở T029; ghi "Kết quả T023" vào `research.md`.

**Checkpoint**: chart cài cạnh Directus chỉ phục vụ domain B; template và kind xanh.

---

## Phase 5: User Story 3 — Chuyển một bản đang chạy chung domain sang domain riêng (Priority: P2) (lượt 2)

**Goal**: `helm upgrade` release cũ không domain dừng, không đổi tài nguyên (US3-1, SC-006); tài liệu chuyển đổi đủ bước
theo thứ tự FR-013; kịch bản 2, 3 kiểm tay theo tài liệu.

**Independent Test**: kind: `helm upgrade bo` với `--set domain.publicUrl=` lỗi, thông báo chứa `domain.publicUrl`,
`generation` của `bo-api` không đổi; README có mục chuyển đổi với 8 bước theo FR-013 (`quickstart.md` §4).

- [ ] T024 [US3] `chart/ci/kind-test.sh`: trước `helm uninstall bo` (:153) thêm khối US3-1: `g=$(kubectl get deployment
      bo-api -o jsonpath='{.metadata.generation}')`; `if out=$(helm upgrade bo "$chart" -f "$chart/ci/values-kind.yaml"
      --set domain.publicUrl= --set ingress.host=cms.test 2>&1); then fail "US3-1: upgrade without the Backoffice domain is
      stopped"; elif echo "$out" | grep -q 'domain.publicUrl' && [ "$(kubectl get deployment bo-api -o
      jsonpath='{.metadata.generation}')" = "$g" ]; then ok "US3-1: upgrade without the Backoffice domain is stopped, nothing
      changed"; else fail "US3-1: message or generation: $out"; fi`.
- [ ] T025 [US3] `deploy/README.md` theo `research.md` R6 và spec FR-013, FR-010, FR-005 (số dòng của 2026-10-28): mục lục
      (:20-24) thêm "Chuyển từ chung domain sang domain riêng", đổi "Domain riêng" → "Chạy cạnh Directus: hai domain";
      "Thay image" (:27-50) thêm câu Q7; "Máy dev" bảng cổng (:80-85): 8090 = Directus qua lb (Directus app ở `/admin`),
      8091 = Backoffice (`/admin` → FE, còn lại → replica BE), 8095, ngẫu nhiên; "Extensions" bỏ bullet Load balancer
      (:162-164); "Domain riêng" (:193-226) → "Chạy cạnh Directus: hai domain" là bố cục mặc định: compose = lệnh mặc định
      (cookie chung trên `localhost` giữ), Kubernetes = `ingress.host` + `domain.publicUrl` bắt buộc với ví dụ values
      (thay `values-separate-domain.yaml`), đoạn `PUBLIC_URL` ("chỉ đặt riêng một biến", Nguyên tắc VIII 3.3.0 thay "ngoại
      lệ T079"), Cookie domain (chart dừng ở mọi lần cài/nâng cấp), SSO, Phiên, Cache giữ, thêm "`PUBLIC_URL` khác nhau:
      link trong thông báo, `Location` TUS, callback SSO mang domain của app ghi"; "Kubernetes" (:228-303): "Ingress chung
      một domain" → "Ingress trên domain Backoffice", bảng value bỏ `apiPool.name`, `domain.publicUrl` "bắt buộc ở
      `shared`", "Kiểm cấu hình khi cài" thêm "thiếu `domain.publicUrl` → dừng (cả `helm template`)" và cookie mọi lần,
      thay "Đưa Directus vào pool" (:265-267) bằng mục "**Chuyển từ chung domain sang domain riêng**" với các bước theo
      thứ tự FR-013 (DNS → cookie FR-076 và SSO allow list → `helm upgrade` với host/publicUrl, replica khởi động lại cuốn
      chiếu, Service `-api-only` và ba path bị xóa → thêm host D vào Ingress Directus ngay sau, khoảng trống, không hai
      Ingress cùng host → kiểm hai domain → user đăng nhập lại, user SAML không còn dùng Backoffice → lùi: `helm rollback`
      rồi trả host D → gỡ nhãn pool sau cùng), đoạn 023 (:269-273) và 024 (:275-280) bỏ "ở chế độ chung domain request rơi
      vào Directus" → "gọi thẳng domain Directus thì Directus 11.17.4 trả lời như của nó", SAML (:294-303) → user SAML chỉ
      dùng Directus app ở domain Directus (Q1), bỏ ví dụ `extraPaths`; "Chạy độc lập" :362 bỏ "không gắn nhãn pool cho
      Directus"; "Quyền import, export" :434-438 "tới Directus" → "gọi thẳng domain Directus", bỏ bullet D-189.7
      (:439-441); `pnpm prettier --check deploy/README.md` (file đang được prettier định dạng).

**Checkpoint**: US3-1 có test trên kind; tài liệu chuyển đổi đủ bước.

---

## Phase 6: Polish (lượt 2)

**Purpose**: ghi chú trỏ về 026 ở spec cũ (FR-014, FR-015), `CLAUDE.md`, `SPECKIT-GUIDE.md`, đóng lượt.

- [ ] T026 [P] Ghi chú `(026: ...)` tại chỗ theo bảng `research.md` R7 (quy ước ở cuối R7; không viết lại nội dung cũ):
      `specs/003-auth-session/spec.md` (US intro, edge case SSO callback, D-24, Assumption SAML);
      `specs/004-permissions/spec.md` (US intro); `specs/014-content-module/spec.md` ("Cần xác nhận": localStorage, link
      share); `specs/020-extensions/spec.md` ("Đã có" 019, US1 Why, US2 intro, FR-040, FR-047, FR-062, D-137 cột Lý do,
      Clarifications ×2); `specs/021-standalone-init-cli/spec.md` (FR-072, FR-080, FR-083);
      `specs/023-json-path-filter/spec.md` (Edge case, khảo sát dòng 10 + kết luận, D-184, Clarifications, Assumption);
      `specs/024-collection-toggles-api/spec.md` (Edge case, FR-016, khảo sát dòng 12 + kết luận, D-188, Clarifications,
      Assumption); `specs/025-policy-import-export/spec.md` (Edge case `/permissions/me`, edge case link share, FR-031,
      FR-033, D-189.1, D-189.7, Clarifications "Lb, Ingress?" và "Duyệt 2026-10-28", khảo sát dòng 17 + kết luận). Kiểm
      SC-007: `grep -rnE "chung domain|shared-domain|rơi vào Directus" specs/0[0-2][0-9]-*/spec.md | grep -v
      "specs/019-\|specs/026-" | grep -v "(026:"` rỗng (câu nào còn thì thêm ghi chú).
- [ ] T027 [P] `CLAUDE.md`: dòng 019 (bỏ "separate-domain override with its own PUBLIC_URL" → "next to Directus Backoffice
      on its own domain, only PUBLIC_URL set apart (026)"), dòng 020 (bỏ "lb/Ingress route /extensions/sources to Backoffice
      only" → "(route removed by 026)"), dòng 025 và Recent Changes 025 ("lb and Ingress route ... (D-189.7)" → "D-189.7
      removed by 026"), dòng 026 ở Active Technologies: "planned" → "implemented 2026-xx-xx in two waves"; thêm dòng 026
      đầu Recent Changes; `SPECKIT-GUIDE.md` mục 026: trạng thái "đã implement", số commit, run CI; `specs/026-.../spec.md`
      không đổi nội dung (chỉ ghi kết quả vào `research.md`).
- [ ] T028 [P] `specs/026-separate-domain-only/research.md`: mục "Kết quả lượt 2" (test-template, kind local/CI, số run,
      lỗi đã sửa); `quickstart.md` §5 chạy hai lệnh grep và ghi kết quả.
- [ ] T029 Đóng lượt 2: `chart/ci/test-template.sh` xanh; `pnpm prettier --check deploy/README.md .github/workflows/ci.yml`;
      `git add` theo đường dẫn (`deploy/helm/backoffice`, `deploy/README.md`, `specs/003-*/spec.md`, `specs/004-*/spec.md`,
      `specs/014-*/spec.md`, `specs/020-*/spec.md`, `specs/021-*/spec.md`, `specs/023-*/spec.md`, `specs/024-*/spec.md`,
      `specs/025-*/spec.md`, `specs/026-separate-domain-only`, `CLAUDE.md`, `SPECKIT-GUIDE.md`); commit `feat(026): Helm
      chart next to Directus on the Backoffice domain only; migration guide; notes in earlier specs`; hỏi phiên "Speckit mở
      rộng cho spec 022", push khi `main` rảnh, gửi số run cho phiên 021; CI xanh (`deploy-k8s`, `deploy`); `graphify
      update .`; ghi số run vào `research.md` và `SPECKIT-GUIDE.md`.

---

## Dependencies

- Lượt 1: T001 → T002 → T003; T004 (compose) và T005 song song; T006–T013 song song sau T002 (T007, T008 cần T004 để chạy
  xanh); T014 độc lập; T015 sau T004–T013; T016 sau T015.
- Lượt 2: T017 → T018, T019 song song → T020 → T021 (test-template cần T017–T020) → T022 → T023; T024 sau T022; T025 độc
  lập (sau T016 để số dòng README còn đúng; đọc lại file trước khi sửa); T026, T027, T028 song song sau T025; T029 cuối.
- US2 và US3 không cần US1 về mặt file (chart ≠ compose), nhưng lượt 2 đi sau lượt 1 theo quy ước commit.

## Parallel Execution Examples

- Lượt 1, sau T002: T005, T006, T007, T008, T009, T010, T011, T012, T013 (mỗi task một file).
- Lượt 2, sau T017: T018, T019; sau T025: T026, T027, T028.

## Implementation Strategy

- MVP = US1 (lượt 1): máy dev và bộ test deploy chạy trên bố cục hai domain; CI `deploy` 2 lượt. Chart chưa đổi vẫn
  xanh ở `deploy-k8s` (kind-test cũ còn gắn nhãn pool: chấp nhận tới lượt 2).
- Lượt 2 = US2 + US3 + Polish: chart, kind, README, ghi chú spec cũ.
- Mỗi lượt một commit lên `main`, push khi rảnh, CI xanh rồi mới sang lượt sau.
- Tổng: 29 task (US1 12: T004–T015; US2 7: T017–T023; US3 2: T024–T025; setup/nền 3: T001–T003; polish 3: T026–T028;
  đóng lượt 2: T016, T029); 14 task `[P]`.
