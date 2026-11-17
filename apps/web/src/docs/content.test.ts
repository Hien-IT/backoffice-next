// Spec 033 T088 (FR-007, FR-018, FR-018a, FR-034..FR-037, SC-003, SC-006; English amendment 2026-11-18): the Markdown
// content, in each language. Every internal link leads to a page of the menu and, with a hash, to a heading of that page
// in the same language (Markdown headings, API endpoints, variable tables); every image is referenced, exists, has a
// description and stays within its size; every guide has steps and an image; the English pages mirror the Vietnamese
// ones and hold no Vietnamese text.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { configTables } from './configuration/variables.ts';
import { configTablesEn } from './configuration/variables.en.ts';
import { docsNavs, flatPages } from './nav.ts';
import { createSlugger, renderDoc } from './render.ts';
import type { DocsApiResource, DocsLang, DocsPage } from './types.ts';

const LANGS: DocsLang[] = ['vi', 'en'];
const dir = (lang: DocsLang) => (lang === 'en' ? 'en/' : '');

const markdown = import.meta.glob<string>('./content/**/*.md', { query: '?raw', import: 'default', eager: true });
const resources = import.meta.glob<DocsApiResource>(['./api/generated/**/*.json', '!**/index.json'], {
	import: 'default',
	eager: true,
});
const tables = { vi: configTables, en: configTablesEn };

const imagesDir = (lang: DocsLang) => join(import.meta.dirname, 'content/images', dir(lang));
const imageFiles = (lang: DocsLang) =>
	existsSync(imagesDir(lang)) ? readdirSync(imagesDir(lang)).filter((file) => file.endsWith('.png')) : [];
const imagesOf = (lang: DocsLang) =>
	Object.fromEntries(imageFiles(lang).map((file) => [`images/${file}`, `/assets/${dir(lang)}${file}`]));

const sourceOf = (page: DocsPage, lang: DocsLang) => markdown[`./content/${dir(lang)}${page.source}.md`]!;

/** The anchors of a page in one language, as DocsRoute gives them. */
function anchorsOf(page: DocsPage, lang: DocsLang): string[] {
	if (page.kind === 'markdown')
		return renderDoc(sourceOf(page, lang), { images: imagesOf(lang) }).headings.map((heading) => heading.id);
	if (page.kind === 'api')
		return resources[`./api/generated/${dir(lang)}${page.source}.json`]!.operations.map((op) => op.anchor);

	const slug = createSlugger();
	return (tables[lang][page.source] ?? []).filter((table) => table.title).map((table) => slug(table.title!));
}

const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

describe.each(LANGS)('docs content (%s)', (lang) => {
	const nav = docsNavs[lang];
	const pages = flatPages(nav);
	const anchors = new Map(pages.map((page) => [page.path, new Set(anchorsOf(page, lang))]));
	const markdownPages = pages.filter((page) => page.kind === 'markdown');
	const guides = nav.sections.find((section) => section.id === 'guides')!.groups.flatMap((group) => group.pages);
	const images = imagesOf(lang);

	test('17 guides: 9 modules, then 8 features only Backoffice has', () => {
		const [modules, features] = nav.sections.find((section) => section.id === 'guides')!.groups;

		expect(modules!.pages).toHaveLength(9);
		expect(features!.pages).toHaveLength(8);
		expect(features!.pages.every((page) => page.backofficeOnly)).toBe(true);
		expect(guides.every((page) => page.kind === 'markdown' && page.source === page.path)).toBe(true);
	});

	test.each(markdownPages.map((page) => [page.path || '(index)', page] as const))(
		'%s: internal links lead to a page and a heading',
		(_, page) => {
			const links = [...sourceOf(page, lang).matchAll(/\]\((\/docs[^)\s]*)\)/g)].map((match) => match[1]!);

			for (const link of links) {
				const [path, hash] = link.replace(/^\/docs\/?/, '').split('#') as [string, string | undefined];
				expect(anchors.has(path), `${link}: no such page`).toBe(true);
				if (hash) expect(anchors.get(path)!.has(hash), `${link}: no such heading`).toBe(true);
			}
		},
	);

	test.each(guides.map((page) => [page.path, page] as const))('%s: steps, an image, headings', (_, page) => {
		const source = sourceOf(page, lang);
		const html = new DOMParser().parseFromString(renderDoc(source, { images }).html, 'text/html');

		expect(html.querySelectorAll('ol > li').length, 'numbered steps').toBeGreaterThan(1);
		expect(html.querySelectorAll('img.docs-image').length, 'an image').toBeGreaterThan(0);
		expect(html.querySelectorAll('h2').length, 'sections').toBeGreaterThan(1);
		// The page title is the h1 of the frame; the content starts at h2.
		expect(html.querySelector('h1')).toBeNull();
		expect(source.startsWith('#')).toBe(false);
	});

	test('every image is used, at most 300 KB', () => {
		const sources = markdownPages.map((page) => sourceOf(page, lang));
		const used = new Set(
			sources.flatMap((source) =>
				[...source.matchAll(/!\[[^\]]*\]\(\.\/(images\/[^)\s]+)\)/g)].map((match) => match[1]!),
			),
		);

		expect([...used].sort()).toEqual(Object.keys(images).sort());
		for (const file of imageFiles(lang))
			expect(statSync(join(imagesDir(lang), file)).size, file).toBeLessThanOrEqual(300 * 1024);
	});
});

describe('the English pages', () => {
	test('every Markdown file has its English counterpart, with the same images in the same order', () => {
		const vi = Object.keys(markdown).filter((file) => !file.startsWith('./content/en/'));
		const en = Object.keys(markdown).filter((file) => file.startsWith('./content/en/'));

		expect(en.map((file) => file.replace('./content/en/', './content/')).sort()).toEqual(vi.sort());

		const imagesIn = (source: string) => [...source.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((match) => match[1]);
		for (const file of vi)
			expect(imagesIn(markdown[file.replace('./content/', './content/en/')]!), file).toEqual(imagesIn(markdown[file]!));
	});

	test('no Vietnamese text in the English content, nav and configuration', () => {
		const english = [
			...Object.entries(markdown).filter(([file]) => file.startsWith('./content/en/')),
			['nav', JSON.stringify(docsNavs.en)],
			['variables.en.ts', JSON.stringify(configTablesEn)],
		] as const;

		for (const [name, text] of english) expect(VIETNAMESE.test(text), name).toBe(false);
	});

	test('all pictures together stay within 8 MB', () => {
		const sizes = LANGS.flatMap((lang) => imageFiles(lang).map((file) => statSync(join(imagesDir(lang), file)).size));
		expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(8 * 1024 * 1024);
	});
});
