// Backoffice (spec 033, data-model §1, research R4): the table of contents of the documentation area. It gives the left
// menu, the breadcrumb and the previous / next links. Titles and leads are content (Vietnamese, FR-038); the three part
// names are frame strings (i18n keys). Guides: one page per module, then one per Backoffice-only feature (FR-018, FR-019).
// The API part follows the generated index (scripts/sync-docs-api.mjs): resources by name, the Backoffice-only routes
// in a last group.
import apiIndex from './api/generated/index.json';
import { configGroups } from './configuration/groups.ts';
import type { DocsGroup, DocsNav, DocsPage, DocsSection } from './types.ts';

/** A guide page: Markdown `content/guides/<id>.md`. */
const guide = (id: string, title: string, lead: string, backofficeOnly = false): DocsPage => ({
	path: `guides/${id}`,
	title,
	lead,
	kind: 'markdown',
	source: `guides/${id}`,
	...(backofficeOnly ? { backofficeOnly: true } : {}),
});

const MODULE_GUIDES: DocsPage[] = [
	guide('content', 'Nội dung', 'Xem, tìm, lọc, tạo và sửa bản ghi của các collection.'),
	guide('files', 'Thư viện tệp', 'Tải file lên, xếp vào thư mục, sửa thông tin và thay nội dung file.'),
	guide('users', 'Người dùng', 'Mời người dùng, sửa thông tin, đổi vai trò và tạm khóa tài khoản.'),
	guide('insights', 'Insights', 'Dựng dashboard với số liệu, biểu đồ và danh sách từ dữ liệu.'),
	guide('activity-notifications', 'Hoạt động và thông báo', 'Đọc thông báo gửi tới bạn và tra lịch sử thao tác trên dữ liệu.'),
	guide('data-model', 'Mô hình dữ liệu', 'Tạo collection và trường, chọn cách nhập và cách hiện của từng trường.'),
	guide('roles-policies', 'Vai trò và chính sách', 'Gom quyền thành chính sách truy cập và gán cho người dùng qua vai trò.'),
	guide('flows', 'Flows', 'Tự động hóa công việc bằng chuỗi bước chạy theo sự kiện, lịch, webhook hay nút bấm.'),
	guide('extensions', 'Phần mở rộng', 'Xem, bật, tắt và gỡ các extension đã cài.'),
];

const FEATURE_GUIDES: DocsPage[] = [
	guide('collection-toggles', 'Ẩn hiện tìm kiếm, import, export', 'Tắt ô tìm kiếm, import hay export của một collection cho mọi người.', true),
	guide('json-path-filter', 'Lọc theo đường dẫn JSON', 'Lọc bản ghi theo một giá trị nằm bên trong trường JSON.', true),
	guide('import-export-permissions', 'Quyền import, export', 'Cho từng chính sách quyền import và export riêng cho mỗi collection.', true),
	guide('field-compare-filter', 'Lọc so sánh hai trường', 'Lọc bản ghi bằng cách so sánh hai trường của cùng bản ghi.', true),
	guide('passkey', 'Passkey', 'Đăng nhập không cần mật khẩu bằng vân tay, khuôn mặt hoặc PIN của thiết bị.', true),
	guide('collection-indexes', 'Index của collection', 'Tạo index ghép và index tìm kiếm ngay từ trang collection.', true),
	guide('extension-upload', 'Tải extension lên', 'Cài extension từ một gói .tgz trên máy.', true),
	guide('environment-sync', 'Đồng bộ môi trường', 'Kéo cấu hình từ một môi trường Backoffice khác về môi trường này.', true),
];

/** A page of the API part: the title is the resource name (technical, as in the API), the lead is Vietnamese. */
function apiPage(resource: (typeof apiIndex.resources)[number]): DocsPage {
	return {
		path: `api/${resource.id}`,
		title: resource.name,
		lead: `${resource.operations} endpoint của ${resource.name}: tham số, trả lời và ví dụ gọi bằng REST, GraphQL.`,
		kind: 'api',
		source: resource.id,
		...(resource.backofficeOnly ? { backofficeOnly: true } : {}),
	};
}

export const docsNav: DocsNav = {
	intro: {
		path: '',
		title: 'Bắt đầu',
		lead: 'Tài liệu của Backoffice có ba phần: hướng dẫn sử dụng, API và cấu hình.',
		kind: 'markdown',
		source: 'index',
	},
	sections: [
		{
			id: 'guides',
			titleKey: 'docs_guides',
			groups: [
				{ title: 'Module', pages: MODULE_GUIDES },
				{ title: 'Tính năng riêng', pages: FEATURE_GUIDES },
			],
		},
		{
			id: 'api',
			titleKey: 'docs_api',
			groups: [
				{ pages: apiIndex.resources.filter((resource) => !resource.backofficeOnly).map(apiPage) },
				{
					title: 'Chỉ có ở Backoffice',
					pages: apiIndex.resources.filter((resource) => resource.backofficeOnly).map(apiPage),
				},
			],
		},
		{
			id: 'configuration',
			titleKey: 'docs_configuration',
			groups: [
				{
					pages: configGroups.map(
						(group): DocsPage => ({
							path: `configuration/${group.id}`,
							title: group.title,
							lead: group.lead,
							kind: 'configuration',
							source: group.id,
						}),
					),
				},
			],
		},
	],
};

/** Every page in menu order: the introduction, then each part, group and page. */
export function flatPages(nav: DocsNav = docsNav): DocsPage[] {
	return [nav.intro, ...nav.sections.flatMap((section) => section.groups.flatMap((group) => group.pages))];
}

/** `guides/files/` and `/guides/files` are the page `guides/files`. */
export function normalizePath(path: string | string[] | undefined): string {
	return [path ?? []]
		.flat()
		.join('/')
		.replace(/^\/+|\/+$/g, '');
}

export function findPage(path: string, nav: DocsNav = docsNav): DocsPage | undefined {
	return flatPages(nav).find((page) => page.path === path);
}

export function neighbours(path: string, nav: DocsNav = docsNav): { previous?: DocsPage; next?: DocsPage } {
	const pages = flatPages(nav);
	const index = pages.findIndex((page) => page.path === path);
	if (index === -1) return {};

	const previous = pages[index - 1];
	const next = pages[index + 1];
	return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}

/** The part and the group of a page, for the breadcrumb; nothing for the introduction or an unknown path. */
export function locate(path: string, nav: DocsNav = docsNav): { section?: DocsSection; group?: DocsGroup } {
	for (const section of nav.sections) {
		for (const group of section.groups) {
			if (group.pages.some((page) => page.path === path)) return { section, group };
		}
	}

	return {};
}

/** Router location of a page. */
export const pageLink = (page: Pick<DocsPage, 'path'>): string => (page.path ? `/docs/${page.path}` : '/docs');
