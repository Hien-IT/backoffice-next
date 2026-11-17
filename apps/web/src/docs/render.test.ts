// Spec 033 T008 (FR-006, FR-010, FR-010a, FR-036, FR-046, research R5).
import { describe, expect, test } from 'vitest';
import { createSlugger, renderDoc } from './render.ts';

const dom = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('renderDoc', () => {
	test('headings get anchors without diacritics; a repeated heading gets a suffix', () => {
		const { html, headings } = renderDoc('## Đồng bộ môi trường\n\n### Bước 1\n\n## Đồng bộ môi trường\n');

		expect(headings).toEqual([
			{ id: 'dong-bo-moi-truong', text: 'Đồng bộ môi trường', level: 2 },
			{ id: 'buoc-1', text: 'Bước 1', level: 3 },
			{ id: 'dong-bo-moi-truong-2', text: 'Đồng bộ môi trường', level: 2 },
		]);

		const h2 = dom(html).querySelector('h2')!;
		expect(h2.id).toBe('dong-bo-moi-truong');
		expect(h2.getAttribute('tabindex')).toBe('-1');

		const anchor = h2.querySelector('a.docs-anchor')!;
		expect(anchor.getAttribute('href')).toBe('#dong-bo-moi-truong');
		expect(anchor.getAttribute('aria-label')).toBe('Copy link to this section: Đồng bộ môi trường');
	});

	// Research [Unverified] 4: DOMPurify drops ids named like DOM properties; ours are set after sanitizing.
	test('headings named like DOM properties keep their id', () => {
		const { html, headings } = renderDoc('## Cookie\n\n## Location\n');

		expect(headings.map((h) => h.id)).toEqual(['cookie', 'location']);
		expect(dom(html).querySelector('#cookie')).not.toBeNull();
		expect(dom(html).querySelector('#location')).not.toBeNull();
	});

	test('a heading without letters still gets an id', () => {
		expect(renderDoc('## ???\n').headings[0]!.id).toBe('section');
		const slug = createSlugger();
		expect([slug('A b'), slug('A b'), slug('A b')]).toEqual(['a-b', 'a-b-2', 'a-b-3']);
	});

	test('note and warning boxes; a plain quote stays a quote', () => {
		const { html } = renderDoc('> [!NOTE]\n> Một **lưu ý**.\n\n> [!WARNING]\n> Cẩn thận.\n\n> Trích dẫn.\n', {
			labels: { note: 'Lưu ý', warning: 'Cảnh báo' },
		});
		const doc = dom(html);
		const note = doc.querySelector('.docs-note-info')!;

		expect(note.getAttribute('role')).toBe('note');
		expect(note.querySelector('.docs-note-title')!.textContent).toBe('Lưu ý');
		expect(note.querySelector('strong')!.textContent).toBe('lưu ý');
		expect(note.textContent).not.toContain('[!NOTE]');
		expect(doc.querySelector('.docs-note-warning .docs-note-title')!.textContent).toBe('Cảnh báo');
		expect(doc.querySelector('blockquote')!.textContent).toContain('Trích dẫn.');
	});

	test('an image takes the built URL; no description, a file name as description or a missing file throw', () => {
		const images = { 'images/files-1.png': '/admin/assets/files-1.abc.png' };
		const img = dom(renderDoc('![Thư viện file với ba thư mục](./images/files-1.png)', { images }).html).querySelector('img')!;

		expect(img.getAttribute('src')).toBe('/admin/assets/files-1.abc.png');
		expect(img.getAttribute('alt')).toBe('Thư viện file với ba thư mục');

		expect(() => renderDoc('![](./images/files-1.png)', { images })).toThrow(/needs a description/);
		expect(() => renderDoc('![files-1.png](./images/files-1.png)', { images })).toThrow(/needs a description/);
		expect(() => renderDoc('![files-1](./images/files-1.png)', { images })).toThrow(/needs a description/);
		expect(() => renderDoc('![Một ảnh](./images/none.png)', { images })).toThrow(/does not exist/);
	});

	test('a table sits in a keyboard-scrollable region and its header cells have a scope', () => {
		const doc = dom(renderDoc('| Biến | Mô tả |\n| --- | --- |\n| `PORT` | Cổng |\n').html);
		const region = doc.querySelector('.docs-table')!;

		expect(region.getAttribute('role')).toBe('region');
		expect(region.getAttribute('aria-label')).toBe('Biến, Mô tả');
		expect(region.getAttribute('tabindex')).toBe('0');
		expect([...doc.querySelectorAll('th')].map((th) => th.getAttribute('scope'))).toEqual(['col', 'col']);
		expect(doc.querySelector('td code')!.textContent).toBe('PORT');
	});

	test('code blocks: highlighted for a known language, plain otherwise, with a copy button', () => {
		const doc = dom(
			renderDoc('```json\n{"a": 1}\n```\n\n```\n<b>plain</b>\n```\n\n```cobol\nMOVE A TO B\n```\n', { labels: { copy: 'Sao chép' } })
				.html,
		);
		const blocks = doc.querySelectorAll('.docs-code');

		expect(blocks).toHaveLength(3);
		expect(blocks[0]!.querySelector('pre')!.getAttribute('tabindex')).toBe('0');
		expect(blocks[0]!.querySelector('code')!.getAttribute('data-lang')).toBe('json');
		expect(blocks[0]!.querySelector('.hljs-attr')).not.toBeNull();
		expect(blocks[0]!.querySelector('button[data-copy]')!.textContent).toBe('Sao chép');
		expect(blocks[1]!.querySelector('code')!.textContent).toBe('<b>plain</b>');
		expect(blocks[1]!.querySelector('b')).toBeNull();
		expect(blocks[2]!.querySelector('code')!.textContent).toBe('MOVE A TO B');
	});

	// Separate inputs: happy-dom's NodeIterator stops after DOMPurify removes a node (see utils/markdown.test.ts).
	test('scripts and event handlers of the content are removed', () => {
		expect(renderDoc('Hi <script>alert(1)</script>').html).not.toContain('<script');
		expect(renderDoc('<img src="x" onerror="alert(1)">').html).not.toContain('onerror');
		expect(renderDoc('[a](javascript:alert(1))').html).not.toContain('javascript:');
	});

	test('links: another origin opens in a new tab, internal ones get the router base', () => {
		const links = dom(
			renderDoc('[ext](https://example.org/x) [trang](/docs/configuration/general#server) [neo](#buoc-1)', { base: '/admin/' }).html,
		).querySelectorAll('a');

		expect(links[0]!.getAttribute('target')).toBe('_blank');
		expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer');
		expect(links[1]!.getAttribute('href')).toBe('/admin/docs/configuration/general#server');
		expect(links[1]!.hasAttribute('target')).toBe(false);
		expect(links[2]!.getAttribute('href')).toBe('#buoc-1');
	});
});
