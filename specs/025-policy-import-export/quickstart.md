# Quickstart: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

## Sau khi cài

`bootstrap` (hoặc `init`) chạy migration `20261028A` tạo `backoffice_permissions`; `start` dừng nếu thiếu. Không seed:
người không phải admin không import, export được cho tới khi admin cấp.

## Cấp quyền

Settings > Access Policies > policy > ma trận: cột Import, Export. Bấm ô → All access, hoặc Use custom (bộ lọc dòng,
field, định dạng). Lưu policy. Hoặc API (admin):

```bash
curl -X POST "$API/backoffice/permissions" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"policy":"<policy-id>","collection":"articles","action":"export",
       "permissions":{"status":{"_eq":"published"}},"fields":["id","title"],"options":{"formats":["csv"]}}'
```

Có tác dụng từ request sau trên mọi replica (cache quyền xóa qua bus). Toggle "Hiện Export"/"Hiện Import" của
collection (022/024) tắt thì vẫn chặn mọi người.

## Kiểm tra bằng tay (user có read, không có export)

```bash
curl -i "$API/items/articles?export=csv" -H "Authorization: Bearer $USER"            # 403 FORBIDDEN
curl -i "$API/items/articles" -H "Authorization: Bearer $USER"                       # 200
curl -i -X POST "$API/utils/import/articles" -H "Authorization: Bearer $USER" -F file=@rows.csv   # 403
curl -s "$API/permissions/me" -H "Authorization: Bearer $USER" | jq '.data.articles'  # có "import", "export"
```

Sau khi cấp export `csv` với field `id,title`:

```bash
curl -i "$API/items/articles?export=csv" -H "Authorization: Bearer $USER"            # 200, chỉ id,title
curl -i "$API/items/articles?export=json" -H "Authorization: Bearer $USER"           # 403 (định dạng)
curl -i "$API/items/articles?export=csv&fields=id,body" -H "Authorization: Bearer $USER"   # 403 (field)
```

Cùng request tới Directus 11.17.4: 200 (D-189.1). Ở compose shared-domain, lb đưa `/permissions/me` và
`/backoffice/*` về Backoffice; import, export rơi vào Directus thì không bị chặn (dùng standalone hoặc separate-domain
để chặn đủ).

## Web

- Content, Users, Files, Presets, Translations: phần Export (và "Download Page as CSV") chỉ khi có quyền export; phần
  Import chỉ khi có quyền import; hộp export chỉ liệt kê định dạng được phép.
- Insights: nút Export dashboard / Import theo quyền trên `directus_dashboards`.
- Không còn mục Shares ở trang item, không còn trang `/admin/shared/<id>`; API `/shares` vẫn như Directus.
- Web nói chuyện với Directus (cấu hình proxy tới Directus): ma trận 4 cột; export theo read, import theo create và
  update (FR-034).

## Test

```bash
pnpm nx run api:test -- backoffice-permissions
pnpm nx run web:test -- system-permissions
pnpm nx run parity-tests:parity -- src/permissions/backoffice-permissions.test.ts
pnpm nx run web-e2e:e2e -- settings-roles-policies settings-permissions-bo
```
