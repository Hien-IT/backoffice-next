# Pre-Tasks Requirements Checklist: Chạy độc lập (021)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước `/speckit.tasks`. Đây là "unit test cho yêu cầu", không phải test hành vi.
**Created**: 2026-10-22
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm** (số trong ngoặc cuối dòng): (1) tương thích DB và migration: seed, 101 migration, `directus_migrations`,
hai chiều với Directus, D-145; (2) hợp đồng CLI: lệnh, option, exit code, thông điệp, D-146, D-147; (3) triển khai và
vận hành: image CMD, compose standalone, Helm Job/ConfigMap, chạy đồng thời, phục hồi; (4) test đối chiếu và CI:
profile `bootstrap`, chuẩn hóa, deploy standalone, kind, SC đo được.
**Độ sâu**: tiêu chuẩn. **Người dùng checklist**: tác giả spec tự rà rồi sửa spec/plan trước `/speckit.tasks`.

Các mục đánh dấu đã đối chiếu với code Directus khi soạn: CHK001, CHK002 (`20251014A-add-project-owner.ts` gọi
`setOwner`, `down` đọc `ACCEPT_TERMS`; `ACCEPT_TERMS` chưa có trong `supported-variables.ts`), CHK021
(`directus/api/src/services/settings.ts` `setOwner` gửi report và đặt `project_status = 'pending'` khi gửi lỗi), CHK022,
CHK023 (`tests/parity/src/spec-differences.ts` đọc ô đầu khớp `^D-\d+$` và ô cuối làm "Gỡ khi").

**Kết quả (2026-10-22)**: chủ dự án chọn cách giải CHK003 (làm giống Directus: không kiểm DB cài dở, chỉ tài liệu phục hồi; D-148 đã đề xuất rồi bỏ), CHK020 (giữ nhãn, chặn
`redshift`), CHK033 (cho phép nâng DB cũ như image Directus), CHK034 (giữ điều kiện của 019); tác giả giải các mục còn lại.
Mọi mục đã áp vào spec, research (R15), data-model, contracts, plan; chỗ sửa ghi sau dấu `→`.

## Requirement Completeness

- [x] CHK001 Các biến env mà migration port đọc (`ACCEPT_TERMS` ở `20250609A-license-banner` và `down` của `20251014A`; `PROJECT_OWNER` ở `up` của `20251014A`) đã được liệt kê là biến hỗ trợ (VIII), kèm ảnh hưởng của chúng lên hàng sau migrate? [Gap, Spec FR-010, FR-025] (1) → FR-010 (cả hai vào danh sách hỗ trợ, nêu cột `accepted_terms` tạo rồi xóa), US1 kịch bản 5, research R6, contracts/tests.md
- [x] CHK002 Spec có nêu `20251014A` tự gọi `setOwner` khi `PROJECT_OWNER` là email (lần thứ nhất, trong migration, trước bước `setOwner` của `bootstrap` ở FR-010), và cả hai lần đều theo D-38? [Gap, Spec FR-010, US1 kịch bản 5] (1) → FR-010, US1 kịch bản 5, bảng tham chiếu D-38, contracts/cli.md
- [x] CHK003 Có yêu cầu phục hồi khi `bootstrap` trên DB trống lỗi giữa chừng (seed tạo được một phần bảng, hoặc migration thứ N ném lỗi): DB ở trạng thái nào, lần chạy sau làm gì, tài liệu hướng dẫn gì? [Gap, Recovery, Spec FR-003, Edge Cases] (1)(3) → FR-015 (giống Directus, test đối chiếu hai app trên DB cài dở), Edge Cases, FR-090, data-model, research R5, R15
- [x] CHK004 Có yêu cầu cho `migrate:down` gỡ một migration hệ thống 11.17.4 (không phải custom): được phép như Directus, và hệ quả `start` dừng vì thiếu (001 D-05) đã được nêu? [Gap, Edge Case, Spec FR-023, FR-036] (1) → Edge Cases, FR-090
- [x] CHK005 Có yêu cầu nêu bảng và hàng nào được ghi trong lần `start` đầu tiên sau `bootstrap` (dòng `directus_extensions` của 020, `directus_activity`/`directus_revisions` do `createAdmin` qua service) và chúng có nằm trong phép so FR-100 hay bị loại? [Gap, Spec FR-100, FR-009] (1)(4) → FR-100 (dump sau khi cả hai app healthy, mọi bảng `directus_*`, không loại bảng nào), research R15
- [x] CHK006 Có yêu cầu không ghi bí mật (`ADMIN_PASSWORD`, `DB_PASSWORD`, `SECRET`, `ADMIN_TOKEN`) vào log của `bootstrap`, `init`, `users create|passwd`, kể cả khi lỗi Knex in cấu hình kết nối? Edge Cases chỉ nêu `ADMIN_TOKEN`. [Gap, Security, Spec Edge Cases, FR-006] (2) → FR-016, FR-102, SC-003, contracts/cli.md "Bí mật", contracts/tests.md
- [x] CHK007 Có yêu cầu thời gian tối đa của `bootstrap` trên Postgres và SQLite trống, làm căn cứ chọn `activeDeadlineSeconds`, healthcheck của compose và startup probe? SC-007 chỉ đo `/server/ping` khi không env. [Gap, Measurability, Spec SC-007, Plan R10] (3) → SC-010, contracts/deploy.md (`activeDeadlineSeconds` gấp 3)
- [x] CHK008 Có yêu cầu `resources` và `securityContext` của Job `bootstrap` (giống Deployment: `runAsNonRoot`, `allowPrivilegeEscalation: false`, drop `ALL`)? [Completeness, Spec FR-081, contracts/deploy.md] (3) → FR-081, FR-080 (`bootstrap.resources`), contracts/deploy.md, data-model, contracts/tests.md kind bước 6
- [x] CHK009 Có yêu cầu cho Helm khi Job lỗi ở lần `install` đầu (chưa có release cũ): release ở trạng thái gì, cài lại thế nào, Job nào còn lại để xem log? [Gap, Recovery, Spec US6 kịch bản 3, FR-082] (3) → US6 kịch bản 3, FR-082, contracts/deploy.md "Trình tự Helm", contracts/tests.md kind bước 7
- [x] CHK010 Có yêu cầu nêu tác động của CMD mới (`bootstrap` rồi `start`) lên mọi cặp parity hiện có (cặp chính trên các vendor, profile `setup`, `retention`, `extensions`...) và các test 019 dựa vào "image không bootstrap" (`image-swap`, thứ tự khởi động của `compose.test.ts`)? [Gap, Coverage, Plan R2, contracts/tests.md] (4) → FR-063
- [x] CHK011 Có yêu cầu cho `--help` của từng lệnh con và thông báo khi gọi lệnh hoặc option không tồn tại (commander), giống Directus? [Completeness, Spec FR-040, FR-044] (2) → FR-040, US3 kịch bản 11, contracts/tests.md `cli.test.ts`

## Requirement Clarity

- [x] CHK012 "Cùng nội dung sau chuẩn hóa" (FR-041, FR-006) có danh sách quy tắc chuẩn hóa nằm trong spec (không chỉ trong contracts/cli.md), đủ để hai người viết test cho cùng kết quả? [Clarity, Spec FR-041, D-147] (2)(4) → FR-107 (danh sách đóng), FR-041, FR-102, contracts/cli.md trỏ về FR-107
- [x] CHK013 "Log cùng mức và cùng nội dung" có nêu so trên trường nào (`msg`, `level`) khi `LOG_STYLE` là pretty hay raw, và khi hai app có pino khác phiên bản? [Clarity, Measurability, Spec FR-006] (2) → FR-006 (cặp `level`, `msg` với `LOG_STYLE=raw`; pretty không so)
- [x] CHK014 Câu chữ thông điệp D-145 (`bootstrap` DB trống, `install`, `migrate:*`) và dòng log khi DB đã cài trên vendor khác được cố định trong spec, hay chỉ có ở contracts/cli.md? [Clarity, Spec FR-008, FR-026, US7] (2) → FR-008, FR-026, contracts/cli.md "Cổng vendor"
- [x] CHK015 "Directus khởi động không cảnh báo migration" (FR-035, SC-002) có nêu đo bằng dòng log nào của Directus (`Database migrations have not all been run`)? [Clarity, Measurability, Spec FR-035] (1)(4) → FR-035, contracts/tests.md `cross.test.ts`
- [x] CHK016 FR-085 mount ConfigMap ở `MIGRATIONS_PATH` "mặc định `/directus/migrations`": khi ConfigMap env đặt `MIGRATIONS_PATH` khác thì chart mount ở đâu, hay chart bắt buộc giá trị mặc định? [Ambiguity, Spec FR-085, contracts/deploy.md] (3) → FR-085 (mount cố định `/directus/migrations`, `_checks.tpl` dừng khi `MIGRATIONS_PATH` trỏ chỗ khác), contracts/deploy.md, contracts/tests.md
- [x] CHK017 Việc dùng lại tên `directus.configMap`/`directus.secret` cho env của Backoffice ở chế độ độc lập có được nêu là giữ tên có chủ ý (tương thích values 019), hay để đổi tên (mục "Cần xác nhận")? [Ambiguity, Spec FR-080, Cần xác nhận] (3) → FR-080 (giữ tên có chủ ý, liệt kê key mới), "Cần xác nhận: Không có"
- [x] CHK018 Có nêu Job chạy `parallelism: 1` và các lần thử lại (`backoffLimit`) tuần tự, để "bootstrap chạy một lần, không lock" không bị chính Job phá? [Clarity, Spec FR-081, FR-007] (3) → FR-081, data-model, contracts/deploy.md
- [x] CHK019 Định nghĩa "nguyên văn" của FR-025 (chỉ đổi header và các specifier import trong bảng) có nằm trong spec, đủ để máy kiểm? Hiện bảng specifier chỉ có ở research R4 và contracts/migrations.md. [Clarity, Spec FR-025, Plan R4] (1) → FR-025 (định nghĩa và bảng specifier)

## Requirement Consistency

- [x] CHK020 Nhãn `PostgreSQL / Redshift` của `init` (D-146) có nhất quán với cổng D-145 (chỉ Postgres và SQLite) khi `DB_CLIENT=redshift` (một `DatabaseClient` riêng)? [Conflict, Spec D-145, D-146, FR-030] (1)(2) → chủ dự án: giữ nhãn, chặn `redshift`; FR-008, FR-030, D-145, D-146, research R5, contracts/cli.md
- [x] CHK021 FR-100 so hàng `directus_settings` của hai bootstrap trong khi `setOwner` của Directus gửi report tới `COMPLIANCE_URL` và đặt `project_status = 'pending'` khi gửi lỗi, còn Backoffice không (D-38): khác biệt này đã nằm trong chuẩn hóa hoặc bảng khác biệt? [Conflict, Spec FR-100, US1 kịch bản 5, D-38] (1)(4) → FR-100 (`COMPLIANCE_URL` trỏ registry giả, đếm report: Directus 2, Backoffice 0), bảng tham chiếu D-38 (trường hợp gửi lỗi), research R15, contracts/tests.md
- [x] CHK022 Bảng khác biệt của 021 kết thúc bằng cột "Duyệt", mà `guard-differences` đọc ô cuối làm "Gỡ khi": quy ước cột, và việc có hay không đăng ký D-145..D-147 trong `accepted-differences.ts` (Plan R11 nói có), đã nhất quán với 019 và 020? [Consistency, Spec Khác biệt, Plan R11] (4) → bảng theo mẫu 020 (cột cuối `Gỡ ở`, `—`), duyệt ghi ở đoạn trên bảng, D-145..D-147 đăng ký `doc` (`feature: '021'`), research R11
- [x] CHK023 Các dòng `D-19 (001, sửa)`, `D-05, D-06 (001, giữ)` có ô ID không khớp mẫu mà parser đọc: spec có nêu đây chỉ là dòng tham chiếu, còn bản sửa thật nằm ở spec 001, 019, 020 (FR-091)? [Consistency, Traceability, Spec FR-091] (4) → bảng riêng "Khác biệt của feature trước được sửa hoặc giữ", FR-091 (danh sách dòng), research R11
- [x] CHK024 Kết quả clarify Q1 (chế độ chung: mỗi replica chạy CMD của image) đã nhất quán giữa Nguyên tắc VII (3.0.0), FR-072, FR-081, FR-082, US5 kịch bản 4, US6 kịch bản 5, data-model và contracts/deploy.md? [Consistency, Spec Clarifications Q1] (3) → sửa Key Entities "Chế độ triển khai" (câu cũ "cả hai có bước bootstrap chạy một lần" sai với Q1); các chỗ còn lại đã khớp
- [x] CHK025 FR-062 (`/directus/migrations` có trong image) có nhất quán với mặc định `MIGRATIONS_PATH=./migrations` khi CLI chạy ở thư mục làm việc khác `/directus` (Edge Cases)? [Consistency, Spec FR-062, Edge Cases] (1)(3) → FR-062 (nêu rõ đường dẫn tương đối theo `WORKDIR`, cwd khác như Directus)
- [x] CHK026 Con số "16 lệnh/biến thể" của SC-003 có khớp danh sách FR-040 và contracts/cli.md (tính hay không tính `--help`, `--version`)? [Consistency, Spec SC-003, FR-040] (2) → SC-003 (16 mục của FR-040, không tính `--help`/`--version`)
- [x] CHK027 Yêu cầu coverage ≥ 80% (Nguyên tắc X, FR-106) có nhất quán với việc loại 101 migration khỏi mẫu số coverage (contracts/tests.md), và lý do loại đã ghi trong spec? [Consistency, Spec FR-106, Constitution X] (4) → FR-106, SC-009, plan Constitution Check X, contracts/tests.md
- [x] CHK028 Thông điệp và mã thoát của `schema apply` khi DB chưa cài (D-147 đổi chữ, mã 0 như Directus) có giống nhau ở US3 kịch bản 7, FR-057 và contracts/cli.md? [Consistency, Spec FR-057] (2) → US3 kịch bản 7, FR-057, D-147 cùng câu chữ

## Acceptance Criteria Quality

- [x] CHK029 SC-001 "0 khác biệt schema" có nêu thuộc tính so cho từng vendor (kiểu cột của SQLite là affinity; default lưu dạng chuỗi), để tiêu chí đo được trên SQLite? [Measurability, Spec SC-001, FR-100] (1)(4) → FR-100 (thuộc tính so, cách đọc trên SQLite), research R15
- [x] CHK030 SC-004 "cache của mọi instance bị xóa, kiểm bằng `x-cache-status` MISS" có nêu request, collection và điều kiện trước đó là HIT? [Measurability, Spec SC-004] (4) → SC-004, research R15, contracts/tests.md `cross.test.ts`
- [x] CHK031 SC-006 "0 request lỗi dưới tải" khi `helm upgrade` có nêu mức tải và thời lượng (như 019 SC-002, ít nhất 5.000 request)? [Measurability, Spec SC-006] (3)(4) → SC-006
- [x] CHK032 SC-005 "dưới 10 phút" và "10 lần chạy" có nêu môi trường đo (runner CI hay máy dev, đã có image hay chưa) như 019? [Clarity, Spec SC-005] (3) → SC-005

## Scenario & Edge Case Coverage

- [x] CHK033 Kịch bản DB do Directus cũ hơn 11.17.4 tạo: `bootstrap` của Backoffice chạy `latest` và nâng DB lên 11.17.4. Spec có nêu đây là hành vi được phép (Backoffice nâng DB Directus), hay phải dừng? [Coverage, Edge Case, Spec Edge Cases] (1) → chủ dự án: cho phép như image Directus; Edge Cases, FR-090, data-model
- [x] CHK034 Ở chế độ chung trên Kubernetes, Deployment Directus và Deployment Backoffice khởi động không theo thứ tự: trên DB trống cả hai cùng bootstrap. Spec có nêu điều kiện trước (DB đã được Directus bootstrap, 019 FR-024) hoặc cách xử lý? [Coverage, Gap, Spec FR-072, FR-082] (3) → chủ dự án: giữ điều kiện 019; Edge Cases, FR-072, FR-082 (NOTES), contracts/deploy.md
- [x] CHK035 Khi ConfigMap migration đổi nhưng chưa `helm upgrade`, pod mới do HPA tạo sẽ dừng ở `start` (FR-085). Có yêu cầu cảnh báo (NOTES, kiểm tra lúc cài) hay chỉ ghi trong tài liệu? [Coverage, Exception, Spec FR-085] (3) → FR-085 (chart không phát hiện được lúc chạy; NOTES và tài liệu nhắc), contracts/deploy.md NOTES
- [x] CHK036 Ở compose độc lập, khi service `bootstrap` thoát mã 1 trong lúc `up -d` trên hệ thống đang chạy: replica cũ dừng hay giữ nguyên? [Coverage, Exception, Spec US5 kịch bản 3, FR-071] (3) → US5 kịch bản 3 (giữ nguyên, phục vụ schema cũ), contracts/tests.md `standalone.test.ts`; hành vi compose [Unverified], kiểm ở lượt 3 (research R15)
- [x] CHK037 `init` khi thư mục đã có `.env`: ghi đè như Directus, hay dừng? Spec chưa nêu. [Edge Case, Gap, Spec US8] (2) → US8 kịch bản 4 (ghi đè như Directus), FR-090, contracts/tests.md `init.test.ts`
- [x] CHK038 `docker run` không env (SQLite ở `/directus/database`) mà không mount volume thì dữ liệu mất khi xóa container. Có yêu cầu tài liệu hoặc cảnh báo cho trường hợp này? [Edge Case, Gap, Spec US1 kịch bản 3, SC-007] (3) → Edge Cases, FR-090

## Dependencies & Assumptions

- [x] CHK039 Phụ thuộc vào phiên bản Docker Compose (`!reset` cần ≥ 2.24; `up --wait` với service chạy một lần) đã ghi phiên bản tối thiểu trong spec hoặc tài liệu? [Assumption, Plan R9, Spec FR-070] (3) → Assumptions, FR-090, research R15
- [x] CHK040 Giả định `inquirer` 12 đọc được stdin không TTY (cách test `init` ở US8) đã được kiểm, hoặc plan có cách thay thế? [Assumption, Spec US8, contracts/tests.md] (2)(4) → Assumptions ([Unverified]), FR-102, research R15 (pseudo-TTY, dự phòng unit), contracts/tests.md
- [x] CHK041 Giả định `20240204A-marketplace` (`resolvePackage` với `__dirname` ở vị trí mới) không ảnh hưởng DB trống đã nêu điều kiện của nó: DB có extension cài từ trước khi Backoffice chạy migration? [Assumption, Plan R4] (1) → research R15 (chỉ ảnh hưởng DB Directus cũ có extension được nâng lên; [Unverified] nếu không có DB mẫu)
- [x] CHK042 Phần phải sửa ở spec 001, 019, 020 (FR-091) có danh sách dòng cụ thể và lượt thực hiện (Plan R13)? [Dependency, Spec FR-091, Plan R13] (4) → FR-091 (danh sách dòng, lượt 3), research R11, R13

## Notes

- Hai mục còn ghi [Unverified] (CHK036 hành vi compose, CHK040 `inquirer` không TTY, CHK041 khi có DB mẫu cũ) đã có
  bước kiểm trong các lượt; chúng không chặn `/speckit.tasks`.
