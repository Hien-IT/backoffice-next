// Spec 033 T011 (FR-002, FR-008, data-model §1).
import { describe, expect, test } from 'vitest';
import apiIndex from './api/generated/index.json';
import { configGroups } from './configuration/groups.ts';
import { docsNav, findPage, flatPages, locate, neighbours, normalizePath, pageLink } from './nav.ts';

const markdown = import.meta.glob('./content/**/*.md');

describe('docs nav', () => {
	test('three parts in order, the introduction first', () => {
		expect(docsNav.sections.map((section) => section.id)).toEqual(['guides', 'api', 'configuration']);
		expect(docsNav.sections.map((section) => section.titleKey)).toEqual([
			'docs_guides',
			'docs_api',
			'docs_configuration',
		]);
		expect(flatPages()[0]).toBe(docsNav.intro);
		expect(docsNav.intro.path).toBe('');
	});

	test('paths are unique; every page has a title and a lead', () => {
		const paths = flatPages().map((page) => page.path);

		expect(new Set(paths).size).toBe(paths.length);
		for (const page of flatPages()) {
			expect(page.title, page.path).not.toBe('');
			expect(page.lead, page.path).not.toBe('');
		}
	});

	test('every source exists and every Markdown file and variable group has one page', () => {
		const pages = flatPages();
		const sources = (kind: string) => pages.filter((page) => page.kind === kind).map((page) => page.source);

		expect(
			sources('markdown')
				.map((source) => `./content/${source}.md`)
				.sort(),
		).toEqual(Object.keys(markdown).sort());
		expect(sources('configuration').sort()).toEqual(configGroups.map((group) => group.id).sort());
		expect(sources('api').sort()).toEqual(apiIndex.resources.map((resource) => resource.id).sort());
	});

	test('previous and next follow the menu order', () => {
		const pages = flatPages();

		expect(neighbours('')).toEqual({ next: pages[1] });
		expect(neighbours(pages[1]!.path)).toEqual({ previous: pages[0], next: pages[2] });
		expect(neighbours(pages.at(-1)!.path)).toEqual({ previous: pages.at(-2) });
		expect(neighbours('no/such/page')).toEqual({});
	});

	test('findPage, locate, normalizePath and pageLink', () => {
		expect(findPage('configuration/general')?.title).toBe('Chung');
		expect(findPage('nope')).toBeUndefined();
		expect(findPage('api/files')).toMatchObject({ title: 'Files', kind: 'api' });
		expect(findPage('api/backoffice')).toMatchObject({ kind: 'api', backofficeOnly: true });
		expect(locate('api/backoffice').group?.title).toBe('Chỉ có ở Backoffice');
		expect(locate('configuration/general').section?.id).toBe('configuration');
		expect(locate('')).toEqual({});
		expect(normalizePath(['configuration', 'general'])).toBe('configuration/general');
		expect(normalizePath('/configuration/general/')).toBe('configuration/general');
		expect(normalizePath(undefined)).toBe('');
		expect(pageLink(docsNav.intro)).toBe('/docs');
		expect(pageLink({ path: 'configuration/general' })).toBe('/docs/configuration/general');
	});
});
