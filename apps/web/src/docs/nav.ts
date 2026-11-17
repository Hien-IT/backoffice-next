// Backoffice (spec 033, data-model §1, research R4): the table of contents of the documentation area. It gives the left
// menu, the breadcrumb and the previous / next links. Titles and leads are content (Vietnamese, FR-038); the three part
// names are frame strings (i18n keys). Guides come with wave 3 of the feature. The API part follows the generated index
// (scripts/sync-docs-api.mjs): resources by name, the Backoffice-only routes in a last group.
import apiIndex from './api/generated/index.json';
import { configGroups } from './configuration/groups.ts';
import type { DocsGroup, DocsNav, DocsPage, DocsSection } from './types.ts';

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
		{ id: 'guides', titleKey: 'docs_guides', groups: [] },
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
