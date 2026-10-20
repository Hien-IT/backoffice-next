# Quickstart: Extensions (020)

Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.23.1/bin:$PATH` trên máy dev có Node khác). Làm trên `main`, không
branch; checkout dùng chung với phiên khác: nhắn trước và sau mỗi push, chỉ stage đường dẫn của 020, không
`stash`/`reset`/`add -A`. Ba lượt (research R14); mỗi lượt xanh mới push.

## Cài

```bash
pnpm install          # catalog: rollup 4.59.0, rolldown, @rollup/plugin-*, chokidar, node-machine-id, tar 7, glob-to-regexp, @directus/composables, axios, semver, @vueuse/router; pinia → 2.3.1
pnpm audit --prod
```

## Bộ extension mẫu

```bash
pnpm --filter @backoffice/extension-fixtures run build      # directus-extension build từng package → dist/ (commit)
pnpm --filter @backoffice/extension-fixtures run pack       # .tgz cho fake registry (commit)
cd apps/web && pnpm exec vitest run ../../tests/fixtures/extensions/fixtures-build.test.ts
```

## API

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,multi,extensions   # minio-init chép fixtures lên s3://directus/extensions/
set -a; . tests/parity/env/postgres.env; set +a
curl -s http://127.0.0.1:8156/extensions -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data[] | {folder: .meta.folder, type: .schema.type, enabled: .meta.enabled}'
curl -s http://127.0.0.1:8156/parity-endpoint-demo                                  # endpoint extension
curl -sI http://127.0.0.1:8156/extensions/sources/index.js                          # bundle app
pnpm nx run parity-tests:parity --vendor=postgres -- src/extensions                 # suite parity
cd apps/api && pnpm exec vitest run src/extensions src/services/extensions.service.test.ts
```

Dev một process: `EXTENSIONS_PATH=../../tests/fixtures/extensions/dist EXTENSIONS_AUTO_RELOAD=true pnpm nx run api:serve`.

## Web

```bash
PUBLIC_URL=http://127.0.0.1:8156 pnpm nx run web:serve        # /admin/settings/extensions, /admin/settings/marketplace
pnpm nx run web:build && grep -o '<script type="importmap">[^<]*' apps/web/dist/index.html
node apps/web/scripts/extract-directus-components.mjs         # fixtures/directus-components.json
cd apps/web && pnpm run test:unit && pnpm exec vitest run --project browser src/directus-shim src/modules/settings/routes/extensions src/modules/settings/routes/marketplace
```

## E2E ba cấu hình, payload, dùng chéo

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=app,setup,sso,web
node apps/web/fixtures/interfaces/seed.mjs --api http://127.0.0.1:8155 --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"   # + bo_ext_items, bo_ext_log
for c in proxy-directus proxy-api cors; do E2E_CONFIG=$c pnpm nx run web-e2e:e2e -- settings-extensions settings-marketplace extensions-app; done
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- payload/extensions extensions-cross-use
```

## Nhiều instance

```bash
pnpm nx run parity-tests:deploy                          # compose 3 BE + Directus, EXTENSIONS_LOCATION=s3, src/deploy/extensions.test.ts
DEPLOY_MODE=separate-domain pnpm nx run parity-tests:deploy
bash deploy/helm/backoffice/ci/test-template.sh          # helm lint, kubeconform, checks (EXTENSIONS_LOCATION)
bash deploy/helm/backoffice/ci/kind-test.sh              # cụm kind
```

## Đóng

```bash
pnpm nx run-many -t lint,typecheck,test,build,check-bundle
node tools/check-port-headers.mjs && node tools/check-package-names.mjs
pnpm nx run web:container && pnpm nx run api:container
```

Cập nhật khi đóng: spec 020 (trạng thái, D-139 danh sách cuối, R-58..R-61), spec 001 (D-17), 010 (D-37), 011 (FR-035),
012 (D-41, D-45, dòng 345), 016 (D-93), `docs/directus-gap-audit.md`, `SPECKIT-GUIDE.md`, `CLAUDE.md` (Active
Technologies, Recent Changes qua `update-agent-context.sh claude`), memory.
