// Spec 033 T088 (FR-007, FR-018, FR-018a, FR-034..FR-037, SC-003, SC-006): the Markdown content. Every internal link
// leads to a page of the menu and, with a hash, to a heading of that page (Markdown headings, API endpoints, variable
// tables); every image is referenced, exists, has a description and stays within its size; every guide has steps and
// an image.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { configTables } from './configuration/variables.ts';
import { docsNav, flatPages } from './nav.ts';
import { createSlugger, renderDoc } from './render.ts';
import type { DocsApiResource, DocsPage } from './types.ts';

const markdown = import.meta.glob<string>('./content/**/*.md', { query: '?raw', import: 'default', eager: true });
const resources = import.meta.glob<DocsApiResource>(['./api/generated/*.json', '!**/index.json'], {
	import: 'default',
	eager: true,
});

const IMAGES_DIR = join(import.meta.dirname, 'content/images');
const imageFiles = readdirSync(IMAGES_DIR).filter((file) => file.endsWith('.png'));
const images = Object.fromEntries(imageFiles.map((file) => [`images/${file}`, `/assets/${file}`]));

const sourceOf = (page: DocsPage) => markdown[`./content/${page.source}.md`]!;

/** The anchors of a page, as DocsRoute gives them. */
function anchorsOf(page: DocsPage): string[] {
	if (page.kind === 'markdown') return renderDoc(sourceOf(page), { images }).headings.map((heading) => heading.id);
	if (page.kind === 'api') return resources[`./api/generated/${page.source}.json`]!.operations.map((op) => op.anchor);

	const slug = createSlugger();
	return (configTables[page.source] ?? []).filter((table) => table.title).map((table) => slug(table.title!));
}

const pages = flatPages();
const anchors = new Map(pages.map((page) => [page.path, new Set(anchorsOf(page))]));
const markdownPages = pages.filter((page) => page.kind === 'markdown');
const guides = docsNav.sections.find((section) => section.id === 'guides')!.groups.flatMap((group) => group.pages);

describe('docs content', () => {
	test('17 guides: 9 modules, then 8 features only Backoffice has', () => {
		const [modules, features] = docsNav.sections.find((section) => section.id === 'guides')!.groups;

		expect(modules!.pages).toHaveLength(9);
		expect(features!.pages).toHaveLength(8);
		expect(features!.pages.every((page) => page.backofficeOnly)).toBe(true);
		expect(guides.every((page) => page.kind === 'markdown' && page.source === page.path)).toBe(true);
	});

	test.each(markdownPages.map((page) => [page.path || '(index)', page] as const))(
		'%s: internal links lead to a page and a heading',
		(_, page) => {
			const links = [...sourceOf(page).matchAll(/\]\((\/docs[^)\s]*)\)/g)].map((match) => match[1]!);

			for (const link of links) {
				const [path, hash] = link.replace(/^\/docs\/?/, '').split('#') as [string, string | undefined];
				expect(anchors.has(path), `${link}: no such page`).toBe(true);
				if (hash) expect(anchors.get(path)!.has(hash), `${link}: no such heading`).toBe(true);
			}
		},
	);

	test.each(guides.map((page) => [page.path, page] as const))('%s: steps, an image, headings', (_, page) => {
		const source = sourceOf(page);
		const html = new DOMParser().parseFromString(renderDoc(source, { images }).html, 'text/html');

		expect(html.querySelectorAll('ol > li').length, 'numbered steps').toBeGreaterThan(1);
		expect(html.querySelectorAll('img.docs-image').length, 'an image').toBeGreaterThan(0);
		expect(html.querySelectorAll('h2').length, 'sections').toBeGreaterThan(1);
		// The page title is the h1 of the frame; the content starts at h2.
		expect(html.querySelector('h1')).toBeNull();
		expect(source.startsWith('#')).toBe(false);
	});

	test('every image is used, at most 300 KB, at most 8 MB together', () => {
		const used = new Set(
			Object.values(markdown).flatMap((source) =>
				[...source.matchAll(/!\[[^\]]*\]\(\.\/(images\/[^)\s]+)\)/g)].map((match) => match[1]!),
			),
		);

		expect([...used].sort()).toEqual(Object.keys(images).sort());

		const sizes = imageFiles.map((file) => statSync(join(IMAGES_DIR, file)).size);
		for (const [i, size] of sizes.entries()) expect(size, imageFiles[i]).toBeLessThanOrEqual(300 * 1024);
		expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThanOrEqual(8 * 1024 * 1024);
	});
});
