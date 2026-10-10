# Contract: Bước dựng schema trong request

## Thứ tự middleware sau feature 002

Thứ tự `apps/api/src/app-pipeline.ts`. Dòng có (002) là phần thêm. Cột phải là bước tương ứng trong
`directus/api/src/app.ts`.

| # | Bước app mới | Directus |
|---|--------------|----------|
| … | pressure, CSP, COOP, HSTS, logger, X-Powered-By, cors, json body, cookie, extractToken, `/`, `/robots.txt`, rate limiter | giống, trừ `/admin` (D-08) |
| 14 | `GET /server/ping` | `:302` |
| 15 | `publicAccountability` | `authenticate` `:307` (D-10) |
| 16 | **`schema`** (002): `req.schema = await getSchema()`, trừ `/server/health` | `schema` `:309`, mọi route |
| — | (chưa có) | `sanitizeQuery` `:311` (D-12, 005) |
| 17 | **`cache`** (002): chỉ gọi `getCache()` rồi `next()` | `cache` `:315` (phần cache response là D-11, 005) |
| 18 | router-options, route Nest, 404, error handler | router, `notFound`, `errorHandler` |

## Route có dựng schema

| Route | Directus | App mới |
|-------|----------|---------|
| `/`, `/robots.txt`, `/server/ping` | không | không |
| `/server/health` (mọi phương thức) | có | **không** (D-13, FR-022) |
| `/server/info`, `/server/specs/oas`, `/metrics`, path lạ, mọi phương thức kể cả `OPTIONS`, `HEAD` | có | có |
| `/admin` | không khi `SERVE_APP=true` (phục vụ app trước bước `schema`); có khi `SERVE_APP=false` | có, rồi trả `404` (D-08) |

Khớp `/server/health` theo cùng quy tắc router của Express: không phân biệt hoa thường, cho phép một `/` ở cuối
(`/SERVER/health/` cũng là health).

## Lỗi

| Tình huống | Directus | App mới |
|------------|----------|---------|
| Dựng schema lỗi (DB mất, `CACHE_SCHEMA=false` hoặc cache trống) | `500 INTERNAL_SERVER_ERROR`, message mặc định của error handler | giống |
| Redis mất, cache trống (`INCRBY` bị ioredis từ chối) | `500` | giống (FR-024) |
| Redis mất, cache còn | route chạy bình thường | giống |
| Hết 3 lần thử | `500` (lỗi `Failed to get Schema information: hit infinite loop`, không lộ ra client) | giống |
| `/server/health` khi DB mất | `500` nếu phải dựng schema, `503 {"status":"error"}` nếu cache còn | luôn `503 {"status":"error"}` (D-13) |

## Dùng schema trong route

- `/server/specs/oas`: `SpecificationService({ accountability, schema: req.schema })`. Không còn dựng mới ở mỗi
  request (thay FR-049 của 001).
- `/server/info`: `ServerService` và `SettingsService` nhận `schema: req.schema`.
- Code trong app không được giữ tham chiếu `req.schema` qua nhiều request.
