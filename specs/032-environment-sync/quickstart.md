# Quickstart: Đồng bộ cấu hình từ môi trường khác (032)

## Bật

Không biến môi trường mới, không migration. Trang có sẵn khi API là Backoffice và ẩn khi API là Directus.

Điều kiện:

- Hai môi trường chạy **cùng phiên bản Backoffice** và có cùng danh sách migration (kể cả migration riêng trong
  `MIGRATIONS_PATH`). Lệch thì bị từ chối.
- Máy chủ của môi trường đích gọi được tới URL của môi trường nguồn. Địa chỉ nằm trong `IMPORT_IP_DENY_LIST` bị chặn;
  mặc định biến này chặn địa chỉ của chính máy và `169.254.169.254`.
- Một static token của user admin ở nguồn (trang user > Token).

## Dùng

1. Đăng nhập admin ở môi trường **đích** (nơi nhận cấu hình).
2. Settings > Đồng bộ môi trường. Nhập URL và token của môi trường nguồn, chọn nhóm, bấm So sánh.
3. Xem bảng: mỗi dòng là "khác nhau", "chỉ ở nguồn" hoặc "chỉ ở đích". Bấm tên dòng để xem giá trị hai bên.
4. Tick dòng hoặc tick ô nhóm. Dòng "chỉ ở đích" phải tick tay; tick nghĩa là xóa ở đích.
5. Bấm Áp dụng, đọc hộp xác nhận, xác nhận.

Chiều ngược lại: đăng nhập ở môi trường kia và làm như trên.

## Bằng API

```bash
curl -s -X POST "$TARGET/backoffice/sync/diff" \
  -H "Authorization: Bearer $TARGET_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"url\":\"$SOURCE\",\"token\":\"$SOURCE_ADMIN_TOKEN\",\"groups\":[\"flows\",\"access\"]}"
```

```bash
curl -s -X POST "$TARGET/backoffice/sync/apply" \
  -H "Authorization: Bearer $TARGET_ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"url\":\"$SOURCE\",\"token\":\"$SOURCE_ADMIN_TOKEN\",\"hash\":\"<hash của diff>\",\"groups\":[\"flows\",\"access\"],\"selected\":[\"flows/flow:<id>\"]}"
```

## Cần biết

- Không gì được lưu: URL, token, danh sách môi trường, lịch sử. Dấu vết duy nhất là activity và revision của từng dòng.
- Token admin của nguồn đi qua trình duyệt và máy chủ đích ở mỗi lượt. Dùng một token riêng cho việc này và đổi nó khi
  không cần nữa.
- Flow giữ `status` của nguồn: flow đang bật chạy ngay ở đích. Dùng `{{$env.TEN_BIEN}}` (biến trong
  `FLOWS_ENV_ALLOW_LIST`) cho URL và token riêng từng môi trường, để cùng một flow chạy đúng ở mọi nơi.
- Không chép: user, file, item, extension. Field settings trỏ tới file chỉ kéo được khi file đó đã có ở đích. Khóa API
  mã hóa trong settings không được so và không được kéo.
- Xóa role làm user của role đó bị đình chỉ và mất role. Xóa collection làm mất dữ liệu của nó.
- Lỗi khi áp dụng hoàn tác toàn bộ (trên Postgres gồm cả thay đổi cấu trúc bảng). Index được tạo và xóa sau cùng, ngoài
  phần hoàn tác.
- Mỗi lúc một lượt áp dụng. Lượt thứ hai nhận lỗi "Another sync is being applied".
- Reverse proxy cắt request dài: lượt áp dụng vẫn chạy hết hoặc hoàn tác hết ở máy chủ; so sánh lại để biết kết quả.

## Chạy test

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=sync
```

```bash
TEST_DB=postgres pnpm nx run parity-tests:parity -- src/sync
```

```bash
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- settings-sync.spec.ts
```

Cú pháp ba lệnh trên theo các feature trước; kiểm lại với `tests/parity/README.md` khi chạy.
