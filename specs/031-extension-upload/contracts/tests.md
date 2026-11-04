# Contract: Kiểm thử (FR-022..FR-025)

## 1. Unit `apps/api`

| File | Kiểm |
|------|------|
| `extensions/lib/installation/manager.test.ts` | `installFromStream` với tar thật tạo trong thư mục tạm của test (fixture `parity-upload-endpoint-1.0.0.tgz`, `parity-upload-bundle-1.0.0.tgz` và tar tự dựng): đích `.upload/<id>`; tar hỏng, thiếu `package/package.json`, manifest sai → `InvalidPayloadError` với reason đúng, thư mục tạm xóa, không đích; tar có mục `../x` không ghi ra ngoài (R2); `MARKETPLACE_TRUST=sandbox` + gói có phần API không sandbox → 400, gói chỉ app → nhận; `EACCES` khi `move` → 503 và dọn; stream `destroy()` giữa chừng → lỗi, không đích (analyze U3); `install(versionId)` cũ vẫn ra `.registry/<versionId>` (mock `download`); `uninstall(folder, 'upload')` xóa `.upload/<folder>` local và kho (mock storage) |
| `extensions/lib/get-extensions.test.ts` | map `upload` từ `.upload`, thư mục ẩn không vào `local` |
| `extensions/lib/get-extensions-settings.test.ts` | dòng tạo cho thư mục `.upload` không có dòng (bật, không gọi `list`), dòng `upload` không có thư mục giữ nguyên, entry bundle `upload` |
| `extensions/manager.test.ts` | `getExtension('upload', folder)`, `extensions` getter gồm upload, `registerApiExtensions` nạp endpoint `upload` khi `enabled`, `installed({ source: 'upload', folder })` broadcast `partialSync: '.upload/<folder>'`, `uninstall(folder, 'upload')`; `updateWatchedExtensions` bỏ `.upload`; cảnh báo `host` không khớp |
| `services/extensions.service.test.ts` | `installUpload`: thứ tự R5, trùng name trong lock → 400 và dọn file; lỗi tạo dòng → dọn; `uninstall` nhận `upload`, từ chối entry bundle; `reinstall` với `upload` 400 (chữ cũ) |
| `controllers/backoffice-extensions.controller.test.ts` (supertest) | GET 200 `{ max_upload_size }` admin / 403 user / 401; POST multipart 200 với mock service; không multipart 400; không file 400; Busboy `limit` → 413 (`FILES_MAX_UPLOAD_SIZE=1kb` trong test); `res.locals.cache === false` |
| `libs/extensions` `generate-extensions-entrypoint.test.ts` | map `upload` vào entrypoint |

## 2. Parity `tests/parity/src/extensions/upload.test.ts` (profile `extensions`, Postgres)

Theo research R8, thứ tự trong một file `describe` serial:

1. D-212: `GET`/`POST /backoffice/extensions/upload` tại Directus → 404 `ROUTE_NOT_FOUND`; tại Backoffice GET → 200.
2. Tải `parity-upload-endpoint-1.0.0.tgz` (FormData, `fetch`) tại Backoffice → 200, `meta.source === 'upload'`; `waitAll`:
   `/parity-upload-endpoint` 200 ở `backoffice` và `backoffice-2`, 404 ở `directus`; `extRows()` có dòng; `mc ls
   local/directus/extensions/.upload/<id>/` có `package.json`, `dist/index.js`.
3. D-212.2: `GET /extensions` tại Directus: dòng id với `schema: null`; tại Backoffice: `schema.type === 'endpoint'`.
   Bundle (analyze C1, chỉ app): tải `parity-upload-bundle-1.0.0.tgz` → 2 dòng con `source: 'upload'` (`upload-iface`,
   `upload-display`), app bundle của Backoffice chứa "Upload Bundle Interface", của Directus không; Directus bỏ 2 dòng con.
   Bật/tắt (C3): `PATCH /extensions/<id> { meta: { enabled: false } }` ở Backoffice → 404 ở hai node, bật lại → 200; cùng
   PATCH ở Directus → Backoffice tắt theo qua bus.
4. FR-023 / D-212.1: `compose restart directus-extensions`; chờ `/server/ping`; `containerLog('directus-extensions',
   since)` không chứa `"level":50`/`error` về extensions; `extRows()` cùng số dòng, không dòng `registry` mới; Directus
   `/parity-upload-endpoint` 404; `GET /extensions` Directus vẫn `schema: null`.
5. Từ chối: `package.json` thường → 400 `not a gzipped tar archive`; tar tự dựng không `package/` → 400 `package/package.json
   is missing`; `parity-endpoint-demo-1.0.0.tgz` (không sandbox) → 400 `MARKETPLACE_TRUST=sandbox requires…`;
   `parity-endpoint-sandbox-1.0.0.tgz` (trùng name với fixture local) → 400 `already installed (local)`; user thường → 403.
   Sau mỗi lần: `extRows()` không đổi, `mc ls local/directus/extensions/.upload/` không thêm thư mục.
6. D-212.3: Directus `DELETE /extensions/registry/uninstall/<id>` → 400 `not installed via marketplace`; Backoffice → 204;
   `waitAll` cả hai node Backoffice 404 endpoint; `extRows()` không còn dòng; `mc ls .upload/<id>` rỗng; gỡ bundle xóa cả
   dòng con, gỡ dòng con → 400 (C1). Đua (C2): `Promise.all` tải `parity-upload-endpoint` ở hai node Backoffice → đúng một
   200, một 400 `already installed (upload)`, một dòng, một thư mục; rồi gỡ.
7. `afterAll`: dọn dòng/thư mục còn sót; `waitAll` các fixture local vẫn 200 (như `install.test.ts`).

`accepted-differences.ts`: D-212 (doc), D-212.1 (doc), D-212.2 (http: `GET /extensions` khác khi gói còn), D-212.3 (doc).
Normalizer `GET /extensions` không đổi: suite gỡ gói ở bước 6 nên `list.test.ts` không thấy.

## 3. Deploy `tests/parity/src/deploy/extension-upload.test.ts` (3 replica, Postgres)

Tải `parity-upload-endpoint-1.0.0.tgz` qua `boLbUrl` → 200; `waitFor` `replicaUrl(1..3)` `/parity-upload-endpoint` 200
trong ≤ 10 s (SC-004); gỡ qua lb → 204; `waitFor` cả ba 404 trong ≤ 10 s. Điều kiện: compose deploy có
`EXTENSIONS_LOCATION` dùng chung (kiểm T001; nếu không, test bật `EXTENSIONS_LOCATION` của deploy env trước và ghi
deploy/README).

## 4. E2E `apps/web-e2e/src/settings-extensions-upload.spec.ts` (ba cấu hình)

- `proxy-directus`: mở `/admin/settings/extensions`, không có nút "Upload extension".
- `proxy-api`, `cors`: nút có; mở dialog, `setInputFiles` `parity-upload-endpoint-1.0.0.tgz` → thành công, toast, hàng
  `[data-extension="parity-upload-endpoint"]` với chip "Uploaded", trạng thái Enabled; axe trên dialog mở; gửi
  `package.json` thường → lỗi trong dialog (`role="alert"`), vẫn mở; menu hàng → Uninstall → xác nhận → hàng biến mất;
  `loadedEverywhere` sau cài, poll 404 sau gỡ (helper `extensions.ts`).
- `allowed-paths.ts`: 232 GET, 233 POST `/backoffice/extensions/upload`.

## 5. Tài liệu

- `deploy/README.md` mục "Tải extension lên (spec 031)": mã tùy ý, `MARKETPLACE_TRUST=sandbox`, `FILES_MAX_UPLOAD_SIZE`,
  `EXTENSIONS_LOCATION` cho nhiều replica, gỡ tay (`.upload/<id>` + dòng), `.upload` ẩn với Directus.
- `specs/020-extensions/spec.md`: ghi chú "(031: nguồn `upload`, `POST /backoffice/extensions/upload`)" ở phần cài extension.
- `tests/parity/README.md`, `CLAUDE.md`, `SPECKIT-GUIDE.md`: 031, D-212..D-212.3.
