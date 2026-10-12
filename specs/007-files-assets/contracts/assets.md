# Contract: `/assets` (007)

Port nguyên `controllers/assets.ts` (thành `AssetsController`) và `services/assets.ts`, `utils/transformations.ts`.
Không có middleware xác thực riêng: `req.accountability` có thể là role public.

## 1. `GET /assets/:pk/:filename?` (Express 5: `:pk{/:filename}`)

Chuỗi ba bước như Directus:

1. **Kiểm query**: đọc `storage_asset_presets` (mặc định `[]`), `storage_asset_transform` (mặc định `all`) từ
   `directus_settings`; chỉ lấy key trong `ASSET_TRANSFORM_QUERY_KEYS` (`key, transforms, width, height, format, fit,
   quality, withoutEnlargement, focal_point_x, focal_point_y`); `transforms` phải là mảng JSON, ≤
   `ASSETS_TRANSFORM_MAX_OPERATIONS` bước, `[0]` ∈ `TransformationMethods`; chế độ `all`: `key` lạ → `400`; `presets`:
   chỉ `?key=<có>` không tham số khác; `none`: chỉ `system-*`. Preset hệ thống `system-{small,medium,large}-{cover,
   contain}` = 64, 300, 800 px, `format: auto`. Lỗi → `400 INVALID_QUERY` với message của Directus.
2. **CSP**: `helmet.contentSecurityPolicy(merge({useDefaults:false, directives:{defaultSrc:["'none'"]}},
   getConfigFromEnv('ASSETS_CONTENT_SECURITY_POLICY')))`.
3. **Phục vụ**: `id = pk.substring(0,36)`; `Vary: Origin, Cache-Control`; `format=auto` → `Accept` có `image/avif` →
   avif, else `image/webp` → webp, thêm `Accept` vào `Vary`; `Range` chỉ parse khi không có transform
   (`/bytes=([0-9]*)-([0-9]*)/`); `ASSETS_CACHE_REVALIDATE=true`: kiểm `If-None-Match`, `If-Modified-Since` sau
   `validateAccess` read, `ETag = "<floor(modified_on/1000)>"`, khớp → `304` với `Cache-Control: max-age=0,
   must-revalidate`, `ETag`, `Last-Modified`.

### Header phản hồi

| Header | Giá trị |
|--------|---------|
| `Content-Disposition` | `res.attachment(filename)` với `filename` = `:filename` → `filename_download` → id; không `?download` → đổi thành `inline; filename=...` |
| `Content-Type` | `file.type`; sau đổi định dạng `contentType(assetFilename)` |
| `Accept-Ranges` | `bytes` |
| `Cache-Control` | revalidate: `max-age=0, must-revalidate`; else `getCacheControlHeader(req, ms(ASSETS_CACHE_TTL), false, true)`: `no-store` khi bỏ cache được phép, `no-cache` khi ttl âm, `public` không role / `private` có role, `max-age=<s>` |
| `Vary` | như trên |
| `Last-Modified`, `ETag` | từ `modified_on` |
| `Content-Range`, `Content-Length` | khi `206`: `bytes s-e/size` |
| `Content-Security-Policy` | theo bước 2 |

`HEAD` → `200` không body. Lỗi stream trước khi gửi header → `500` JSON.

## 2. `AssetsService.getAsset(id, {transformationParams, range})`

1. `systemPublicKeys` = `project_logo`, `public_background`, `public_foreground`, `public_favicon` của settings → bỏ kiểm
   quyền. Id không uuid → `403`. Không admin và có accountability → `validateItemAccess({action:'read',
   collection:'directus_files', primaryKeys:[id], returnAllowedRootFields:true})`, không được → `403`; field đọc được
   giới hạn như `sanitizeFields` (+ `type`, `filesize`). Dòng đọc sudo; object không tồn tại trên storage → `403`.
2. Range: `416` khi cả hai đầu undefined, `end <= start`, `start >= filesize`, `end <= 0`; chỉ `end` → suffix range.
3. Transform (`resolvePreset`): `format` hoặc `quality` → `toFormat`; `width` hoặc `height` → `resize`; `fit=cover`
   (hoặc không fit) + đủ width, height + focal point → `resize` + `extract` quanh focal point; `withoutEnlargement`
   kẹp theo kích thước gốc. `getFormat`: rõ → dùng; `auto` → theo `Accept`; nguồn avif, webp, tiff → png; else subtype
   nguồn hoặc `jpg`. Chỉ áp cho `type` ∈ jpeg, png, webp, tiff, avif; loại khác trả nguyên bản (bỏ transform).
4. Tên file phát sinh (FR-035):
   ```ts
   const assetFilename =
     path.basename(file.filename_disk, path.extname(file.filename_disk)) +
     getAssetSuffix(transforms) +                       // '' hoặc `__${objectHash(transforms)}`
     (maybeNewFormat ? `.${maybeNewFormat}` : path.extname(file.filename_disk)); // toFormat cuối
   ```
   Đã có → stream với `range`. Chưa có: thiếu width/height hoặc > `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` → `400
   IllegalAssetTransformation`; `sharp.counters().queue + process > ASSETS_TRANSFORM_MAX_CONCURRENT` → `503 "Server
   too busy"`; `transformer.timeout({seconds: clamp(round(ms(ASSETS_TRANSFORM_TIMEOUT)/1000), 1, 3600)})`; `rotate()`
   trừ khi có bước `rotate`; áp từng bước `transformer[method](...args)`, lỗi "Expected…" → `400`; pipe vào storage với
   `ContentType` gốc; lỗi → xóa object dở; timeout → `503 "Transformation timed out"`.
5. Đọc storage với `version = floor(modified_on/1000)`.

## 3. Zip

| Route | Body | Phản hồi |
|-------|------|----------|
| `POST /assets/folder/:pk` | — | `application/zip`, `Content-Disposition: attachment; filename="folder-<name|unknown>-<datetime>.zip"`; `zipFolder` dùng `FoldersService.buildTree` (quyền đọc gốc, khử trùng tên) + archiver |
| `POST /assets/files` | zod `{ids: uuid[] min 1}` | `files-<datetime>.zip` |

Lỗi stream → `500` JSON. Bộ đối chiếu so danh sách entry (đường dẫn) và nội dung từng entry, không so byte zip.

## 4. Env và hằng

| Biến | Mặc định | Dùng |
|------|----------|------|
| `ASSETS_CACHE_TTL` | `30d` | `Cache-Control` |
| `ASSETS_CACHE_REVALIDATE` | `false` | `304` |
| `ASSETS_TRANSFORM_MAX_CONCURRENT` | `25` | hàng đợi sharp, theo process |
| `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` | `6000` | `limitInputPixels = n²`, kích thước đích |
| `ASSETS_TRANSFORM_MAX_OPERATIONS` | `5` | số bước `transforms` |
| `ASSETS_TRANSFORM_TIMEOUT` | `7500ms` | timeout sharp |
| `ASSETS_INVALID_IMAGE_SENSITIVITY_LEVEL` | `warning` | `failOn` |
| `ASSETS_CONTENT_SECURITY_POLICY_*` | — | CSP |

`getSharpInstance()`: `limitInputPixels`, `sequentialRead: true`, `failOn`.

## 5. Bằng chứng byte (R2)

Fixture của `directus/tests/e2e/tests/endpoints/assets/` (`image.jpg`, `img_50x50.jpg`, các ảnh kết quả) copy vào
`tests/parity/fixtures/assets/`; ca đầu của `transform-matrix.test.ts` so output của cả hai app với fixture trước khi
chạy ma trận. Lệch → ghi bằng chứng (hash, kích thước, `sharp.versions`) vào tasks và báo tech lead (Clarifications).
