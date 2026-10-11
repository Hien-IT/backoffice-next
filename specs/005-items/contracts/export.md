# Contract: query `export` (005)

Nguồn: `directus/api/src/middleware/respond.ts` (phần export), `services/import-export.ts` (`ExportService.transform`),
`packages/utils/shared/get-date-time-formatted.ts`. Áp cho mọi route đi qua `respond` và mọi method có payload.

## 1. Định dạng

| `export` | Phần mở rộng | `Content-Type` đặt | `Content-Type` trả (Express thêm charset khi `send` chuỗi) | Body |
|----------|--------------|--------------------|-----------------------------------------------------------|------|
| `json` | `.json` | `application/json` | `application/json; charset=utf-8` | `JSON.stringify(data ?? null, null, '\t')` |
| `xml` | `.xml` | `text/xml` | `text/xml; charset=utf-8` | `js2xmlparser.parse('data', data)` |
| `csv` | `.csv` | `text/csv` | `text/csv; charset=utf-8` | `json2csv` `Parser({ transforms: [flatten({ separator: '.' })], header: true, withBOM: false }).parse(data)`; `''` khi `data.length === 0` |
| `csv_utf8` | `.csv` | `text/csv; charset=utf-8` | `text/csv; charset=utf-8` | như `csv` với `withBOM: true` |
| `yaml` | `.yaml` | `text/yaml` | `text/yaml; charset=utf-8` | `js-yaml.dump(data)` |
| khác | — | — | — | `400 INVALID_QUERY` ở `validateQuery` (004) |

Cột "trả" là `[Suy luận]` từ cách Express `res.send(string)` thêm `charset=utf-8` khi `Content-Type` dạng text và chưa
có charset; ca FR-044 đo và là nguồn cuối.

## 2. Tên file và header

- `filename = (req.collection ?? 'Export') + ' ' + getDateTimeFormatted()`;
  `getDateTimeFormatted()` = `YYYYMMDD-HMS` với tháng, ngày đệm 0, giờ, phút, giây **không** đệm (ví dụ
  `20261011-9530` cho 09:05:30), theo múi giờ của process (`TZ`).
- `res.attachment(filename + ext)` → `Content-Disposition: attachment; filename="articles 20261011-123456.csv"`
  (gói `content-disposition`, cùng ở Express 4 và 5; tên có ký tự ngoài ASCII thêm `filename*=UTF-8''...`).
- Status `200` kể cả khi route gốc sẽ trả `204` (không payload).
- Không lưu cache, `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`.

## 3. Trường hợp biên (FR-021, đo trong bộ đối chiếu)

Đo ở Postgres, hai app cùng giá trị (T025, 2026-10-11). Mảng gồm nhiều dòng: mỗi dòng nằm trong một phần tử `data` con
(`js2xmlparser` 5.0.0); object: các field là con trực tiếp của `data`. Lỗi `500` của csv với admin có message
`Cannot read properties of undefined (reading 'length')` (chưa đo với người không phải admin, dự kiến `An unexpected
error occurred.` theo error handler 001).

| Trường hợp | `json` | `csv`, `csv_utf8` | `xml` | `yaml` |
|------------|--------|-------------------|-------|--------|
| `data` là mảng rỗng | `[]` | `''` | `<?xml version='1.0'?>\n<data/>` | `[]\n` |
| không có payload (`204`) | `200`, `null` | `500 INTERNAL_SERVER_ERROR`, `Content-Type: text/csv; charset=utf-8` giữ nguyên | `200`, `<?xml version='1.0'?>\n<data>undefined</data>` | `200`, body rỗng |
| `data` là object (một item, singleton, `/server/info`) | object thụt lề | một dòng CSV | gốc `data` với con | object |
| giá trị lồng (m2o mở rộng) | lồng | cột `a.b` (flatten một cấp cho object; mảng giữ JSON) | lồng | lồng |

## 4. Bộ đối chiếu (FR-044)

Mỗi định dạng × {danh sách có m2o, o2m lồng; một item; singleton; rỗng; `SEARCH`; `GET /users`; `GET /server/info`;
`204`; giá trị lạ}: so status, `content-type`, `content-disposition` (thay phần `YYYYMMDD-HMS` bằng dấu hiệu), body
từng byte sau chuẩn hóa id và ngày.
