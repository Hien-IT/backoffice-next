# Data Model: Trang tài liệu (docs) trong app Backoffice

**Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Không bảng, cột, migration, khóa Redis hay dòng cache nào. Mọi dữ liệu là file tĩnh trong `apps/web/src/docs/`, đi cùng
bản build của app. Tên kiểu dưới đây là đề xuất cho `apps/web/src/docs/types.ts`.

## 1. Mục lục khu tài liệu (`nav.ts`, viết tay)

```ts
type DocsSectionId = 'guides' | 'api' | 'configuration';

interface DocsNav {
	intro: DocsPage; // path ''
	sections: DocsSection[]; // đúng ba phần, theo thứ tự hiển thị
}

interface DocsSection {
	id: DocsSectionId;
	titleKey: string; // khóa i18n của khung: docs_guides, docs_api, docs_configuration
	groups: DocsGroup[];
}

interface DocsGroup {
	title?: string; // tiêu đề nhóm (nội dung, tiếng Việt); bỏ trống thì nhóm không có tiêu đề
	pages: DocsPage[];
}

interface DocsPage {
	path: string; // duy nhất, ví dụ 'guides/files', 'api/files', 'configuration/general'
	title: string; // hiện ở menu trái, breadcrumb, tiêu đề trang
	lead: string; // câu dẫn
	kind: 'markdown' | 'api' | 'configuration';
	source: string; // markdown: đường dẫn file; api: tên file sinh; configuration: id nhóm biến
	backofficeOnly?: boolean; // ghi chú "chỉ có khi máy chủ là Backoffice" (FR-019, FR-027)
}
```

Quy tắc:

- `path` duy nhất; thứ tự phẳng của mọi trang (intro, rồi từng phần, nhóm, trang) cho trang trước và trang sau (FR-008).
- Phần `guides` có đúng 17 trang của FR-016 và FR-017, chia hai nhóm "Module" và "Tính năng riêng".
- Phần `api`: một trang cho mỗi file sinh của §3; nhóm cuối là các endpoint riêng của Backoffice.
- Phần `configuration`: một trang cho mỗi nhóm biến của §4.
- Test: mọi `source` tồn tại; mọi file markdown, file sinh và nhóm biến có đúng một trang trỏ tới.

## 2. Trang markdown (`content/**/*.md`, viết tay)

Markdown GFM với các phần mở rộng của research R5:

| Cú pháp | Kết quả |
| --- | --- |
| `## `, `### ` | Tiêu đề có anchor, vào mục lục "Trên trang này" (hai cấp) |
| `> [!NOTE]`, `> [!WARNING]` ở dòng đầu blockquote | Ô ghi chú thông tin, cảnh báo |
| Khối code có ngôn ngữ `bash`, `json`, `graphql` | Tô màu, có nút chép; ngôn ngữ khác hoặc không ghi: một màu |
| `![mô tả](./images/<file>.png)` | Ảnh; thiếu mô tả hoặc file không có là lỗi của test |
| Link `/docs/...`, `#anchor`, `./trang.md` không dùng | Link nội bộ viết dạng `/docs/<path>#<anchor>`; link `http(s)` mở tab mới |

Sau khi render, mỗi trang có danh sách tiêu đề:

```ts
interface DocsHeading {
	id: string; // slug không dấu, duy nhất trong trang (hậu tố -2, -3 khi trùng)
	text: string;
	level: 2 | 3;
}
```

Tiêu đề cấp 1 không dùng trong file (tiêu đề trang lấy từ `nav.ts`).

## 3. Resource API (`api/generated/<resource>.json`, sinh bằng script, commit)

```ts
interface DocsApiResource {
	$source: string; // nguồn và tên script, như các file sinh khác của app
	id: string; // slug của tag, cũng là tên file
	name: string; // tên tag
	description: string;
	collection?: string; // x-collection của tag
	backofficeOnly: boolean;
	operations: DocsApiOperation[];
	schemas: Record<string, JsonSchema>; // schema được các operation tham chiếu theo tên
}

interface DocsApiOperation {
	id: string; // operationId
	anchor: string; // slug của summary, duy nhất trong resource
	method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' | 'SEARCH';
	path: string;
	summary: string;
	description: string;
	query: DocsApiParameter[];
	pathParams: DocsApiParameter[];
	body?: { contentType: string; required: boolean; schema: JsonSchema };
	responses: { status: string; description: string; schema?: JsonSchema }[];
	rest: string; // lệnh curl
	graphql: string | false; // false: không có tương đương
	responseExample?: unknown;
	backofficeOnly: boolean;
	access?: 'admin' | 'authenticated' | 'public'; // ai gọi được; bắt buộc khi backofficeOnly (FR-027)
}

interface DocsApiParameter {
	name: string;
	type: string;
	required: boolean;
	description: string;
}
```

Nguồn: `libs/specs/dist/openapi.json` (67 path, 133 operation, 23 tag) cộng `api/supplement/*.yaml` (cùng dạng OpenAPI:
`tags`, `paths`, `components`). Quy tắc của script:

- Một resource cho mỗi tag; operation có nhiều tag vào resource của tag đầu.
- Tham số `$ref` được thay bằng nội dung; schema của body và trả lời giữ `$ref` tới `schemas` của chính file.
- Mọi operation của file bổ sung dưới `/backoffice/` có `backofficeOnly: true`.
- `example` có từ "Directus" đứng riêng được thay bằng "Backoffice" (research R7).
- Danh sách loại trừ có lý do cho operation Backoffice không phục vụ (research R7, [Unverified] cho tới lượt 2).

## 4. Biến môi trường

File sinh `configuration/supported.generated.json` (script, commit):

```ts
interface SupportedGenerated {
	$source: string;
	variables: { pattern: string; exact: boolean; default?: string }[];
	// pattern: nguồn của RegExp trong SUPPORTED_VARIABLES; exact: không có ký tự mẫu
}
```

File viết tay `configuration/variables.ts`:

```ts
interface ConfigGroup {
	id: string; // cũng là path của trang: configuration/<id>
	title: string;
	lead: string;
	tables: { title?: string; note?: string; rows: ConfigRow[] }[];
}

interface ConfigRow {
	name: string; // tên biến, hoặc mẫu hiển thị như `DB_*`
	pattern: string; // khớp đúng một mục của supported.generated.json
	description: string;
	note?: string;
}
```

Quy tắc (test, FR-030..FR-033, FR-051):

- Mỗi mục của file sinh có đúng một `ConfigRow`; mỗi `ConfigRow` khớp đúng một mục.
- Cột Mặc định lấy từ file sinh; mục không có mặc định để trống.
- `description` và `note` không chứa giá trị thật của bí mật (FR-015).

## 5. Ảnh chụp

File `content/images/<trang>-<n>.png`. Mỗi ảnh ứng với một bước `shot()` trong một file
`apps/web-e2e/src/docs-shots/<trang>.shots.ts`:

```ts
interface DocsShot {
	file: string; // tên file ảnh
	// các bước Playwright đưa app tới màn hình cần chụp, và vùng cần che
}
```

Quy tắc: mọi ảnh trong thư mục được ít nhất một trang markdown nhắc tới và có một bước chụp sinh ra nó; mọi ảnh trang
nhắc tới có trong thư mục; mỗi ảnh ≤ 300 KB, tổng ≤ 8 MB (đề xuất, research R10).

## 6. Trạng thái trong trình duyệt

Không lưu gì mới. Trang chỉ đọc route (path, hash). `last_page` của user do guard có sẵn ghi như mọi trang private.
