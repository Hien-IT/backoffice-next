// Backoffice (spec 033, data-model §1, research R4): the table of contents of the documentation area. It gives the left
// menu, the breadcrumb and the previous / next links. Titles and leads are content, in Vietnamese and in English (FR-038,
// amendment 2026-11-18: one nav per language, the same paths in both); the three part names are frame strings (i18n
// keys). Guides: one page per module, then one per Backoffice-only feature (FR-018, FR-019). The API part follows the
// generated index (scripts/sync-docs-api.mjs): resources by name, the Backoffice-only routes in a last group.
import apiIndex from './api/generated/index.json';
import { configGroups } from './configuration/groups.ts';
import type { DocsGroup, DocsLang, DocsNav, DocsPage, DocsSection } from './types.ts';

type Text = Record<DocsLang, { title: string; lead: string }>;

/** A guide page: Markdown `content/guides/<id>.md` (English: `content/en/guides/<id>.md`). */
const guide =
	(id: string, text: Text, backofficeOnly = false) =>
	(lang: DocsLang): DocsPage => ({
		path: `guides/${id}`,
		...text[lang],
		kind: 'markdown',
		source: `guides/${id}`,
		...(backofficeOnly ? { backofficeOnly: true } : {}),
	});

const MODULE_GUIDES = [
	guide('content', {
		vi: { title: 'Nội dung', lead: 'Xem, tìm, lọc, tạo và sửa bản ghi của các collection.' },
		en: { title: 'Content', lead: 'View, search, filter, create and edit the items of your collections.' },
	}),
	guide('files', {
		vi: { title: 'Thư viện tệp', lead: 'Tải file lên, xếp vào thư mục, sửa thông tin và thay nội dung file.' },
		en: {
			title: 'File Library',
			lead: 'Upload files, sort them into folders, edit their details and replace their content.',
		},
	}),
	guide('users', {
		vi: { title: 'Người dùng', lead: 'Mời người dùng, sửa thông tin, đổi vai trò và tạm khóa tài khoản.' },
		en: { title: 'Users', lead: 'Invite users, edit their details, change their role and suspend accounts.' },
	}),
	guide('insights', {
		vi: { title: 'Insights', lead: 'Dựng dashboard với số liệu, biểu đồ và danh sách từ dữ liệu.' },
		en: { title: 'Insights', lead: 'Build dashboards with metrics, charts and lists from your data.' },
	}),
	guide('activity-notifications', {
		vi: { title: 'Hoạt động và thông báo', lead: 'Đọc thông báo gửi tới bạn và tra lịch sử thao tác trên dữ liệu.' },
		en: {
			title: 'Activity and Notifications',
			lead: 'Read the notifications sent to you and look up what was done to the data.',
		},
	}),
	guide('data-model', {
		vi: { title: 'Mô hình dữ liệu', lead: 'Tạo collection và trường, chọn cách nhập và cách hiện của từng trường.' },
		en: { title: 'Data Model', lead: 'Create collections and fields, and choose how each field is entered and shown.' },
	}),
	guide('roles-policies', {
		vi: {
			title: 'Vai trò và chính sách',
			lead: 'Gom quyền thành chính sách truy cập và gán cho người dùng qua vai trò.',
		},
		en: {
			title: 'Roles and Policies',
			lead: 'Group permissions into access policies and give them to users through roles.',
		},
	}),
	guide('flows', {
		vi: { title: 'Flows', lead: 'Tự động hóa công việc bằng chuỗi bước chạy theo sự kiện, lịch, webhook hay nút bấm.' },
		en: {
			title: 'Flows',
			lead: 'Automate work with chains of steps run by an event, a schedule, a webhook or a button.',
		},
	}),
	guide('extensions', {
		vi: { title: 'Phần mở rộng', lead: 'Xem, bật, tắt và gỡ các extension đã cài.' },
		en: { title: 'Extensions', lead: 'View, enable, disable and remove the installed extensions.' },
	}),
];

const FEATURE_GUIDES = [
	guide(
		'collection-toggles',
		{
			vi: {
				title: 'Ẩn hiện tìm kiếm, import, export',
				lead: 'Tắt ô tìm kiếm, import hay export của một collection cho mọi người.',
			},
			en: {
				title: 'Search, Import and Export Toggles',
				lead: 'Turn off the search box, import or export of a collection for everyone.',
			},
		},
		true,
	),
	guide(
		'json-path-filter',
		{
			vi: { title: 'Lọc theo đường dẫn JSON', lead: 'Lọc bản ghi theo một giá trị nằm bên trong trường JSON.' },
			en: { title: 'JSON Path Filter', lead: 'Filter items by a value inside a JSON field.' },
		},
		true,
	),
	guide(
		'import-export-permissions',
		{
			vi: {
				title: 'Quyền import, export',
				lead: 'Cho từng chính sách quyền import và export riêng cho mỗi collection.',
			},
			en: {
				title: 'Import and Export Permissions',
				lead: 'Give each policy its own import and export permission per collection.',
			},
		},
		true,
	),
	guide(
		'field-compare-filter',
		{
			vi: { title: 'Lọc so sánh hai trường', lead: 'Lọc bản ghi bằng cách so sánh hai trường của cùng bản ghi.' },
			en: { title: 'Field Comparison Filter', lead: 'Filter items by comparing two fields of the same item.' },
		},
		true,
	),
	guide(
		'passkey',
		{
			vi: { title: 'Passkey', lead: 'Đăng nhập không cần mật khẩu bằng vân tay, khuôn mặt hoặc PIN của thiết bị.' },
			en: { title: 'Passkeys', lead: "Sign in without a password, with your device's fingerprint, face or PIN." },
		},
		true,
	),
	guide(
		'collection-indexes',
		{
			vi: { title: 'Index của collection', lead: 'Tạo index ghép và index tìm kiếm ngay từ trang collection.' },
			en: { title: 'Collection Indexes', lead: 'Create composite and search indexes right from the collection page.' },
		},
		true,
	),
	guide(
		'extension-upload',
		{
			vi: { title: 'Tải extension lên', lead: 'Cài extension từ một gói .tgz trên máy.' },
			en: { title: 'Extension Upload', lead: 'Install an extension from a .tgz package on your computer.' },
		},
		true,
	),
	guide(
		'environment-sync',
		{
			vi: { title: 'Đồng bộ môi trường', lead: 'Kéo cấu hình từ một môi trường Backoffice khác về môi trường này.' },
			en: {
				title: 'Environment Sync',
				lead: 'Pull the configuration of another Backoffice environment into this one.',
			},
		},
		true,
	),
];

/** A page of the API part: the title is the resource name (technical, as in the API). */
function apiPage(resource: (typeof apiIndex.resources)[number], lang: DocsLang): DocsPage {
	return {
		path: `api/${resource.id}`,
		title: resource.name,
		lead:
			lang === 'vi'
				? `${resource.operations} endpoint của ${resource.name}: tham số, trả lời và ví dụ gọi bằng REST, GraphQL.`
				: `${resource.operations} ${resource.name} endpoints: parameters, responses and REST and GraphQL examples.`,
		kind: 'api',
		source: resource.id,
		...(resource.backofficeOnly ? { backofficeOnly: true } : {}),
	};
}

function buildNav(lang: DocsLang): DocsNav {
	const vi = lang === 'vi';

	return {
		intro: {
			path: '',
			title: vi ? 'Bắt đầu' : 'Getting Started',
			lead: vi
				? 'Tài liệu của Backoffice có ba phần: hướng dẫn sử dụng, API và cấu hình.'
				: 'The Backoffice documentation has three parts: user guides, the API and the configuration.',
			kind: 'markdown',
			source: 'index',
		},
		sections: [
			{
				id: 'guides',
				titleKey: 'docs_guides',
				groups: [
					{ title: 'Module', pages: MODULE_GUIDES.map((page) => page(lang)) },
					{ title: vi ? 'Tính năng riêng' : 'Backoffice Features', pages: FEATURE_GUIDES.map((page) => page(lang)) },
				],
			},
			{
				id: 'api',
				titleKey: 'docs_api',
				groups: [
					{ pages: apiIndex.resources.filter((resource) => !resource.backofficeOnly).map((r) => apiPage(r, lang)) },
					{
						title: vi ? 'Chỉ có ở Backoffice' : 'Backoffice Only',
						pages: apiIndex.resources.filter((resource) => resource.backofficeOnly).map((r) => apiPage(r, lang)),
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
								...(vi ? { title: group.title, lead: group.lead } : group.en),
								kind: 'configuration',
								source: group.id,
							}),
						),
					},
				],
			},
		],
	};
}

/** The nav of each content language: the same pages and paths, the texts in that language. */
export const docsNavs: Record<DocsLang, DocsNav> = { vi: buildNav('vi'), en: buildNav('en') };

/** The Vietnamese nav, the default of the helpers below. */
export const docsNav: DocsNav = docsNavs.vi;

/** The content language of an app language: Vietnamese for `vi-*`, English for every other. */
export const docsLangOf = (locale: string): DocsLang => (locale.toLowerCase().startsWith('vi') ? 'vi' : 'en');

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
