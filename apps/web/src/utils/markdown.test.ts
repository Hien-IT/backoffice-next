import { describe, expect, test } from 'vitest';
import { md, sanitize } from './markdown.ts';

describe('md', () => {
	test('renders markdown', () => {
		expect(md('**Hi** _there_')).toBe('<p><strong>Hi</strong> <em>there</em></p>\n');
	});

	// Separate inputs: happy-dom's NodeIterator stops after DOMPurify removes a <script>, so nodes after it are not
	// visited there (real browsers follow the DOM spec).
	test('strips scripts', () => {
		expect(md('Hi <script>alert(1)</script>')).toBe('<p>Hi </p>\n');
	});

	test('strips event handlers and javascript: links', () => {
		const html = md('<img src="x" onerror="alert(1)">\n\n[a](javascript:alert(1)) <a href="javascript:alert(2)">b</a>');

		expect(html).not.toContain('onerror');
		expect(html).not.toContain('javascript:');
		expect(html).toContain('<img src="x">');
	});

	test('opens links to another origin in a new tab with noopener', () => {
		const html = md('[ext](https://example.org/x) [int](/admin/content) [mail](mailto:a@b.c)');
		const links = new DOMParser().parseFromString(html, 'text/html').querySelectorAll('a');

		expect(links[0]!.getAttribute('target')).toBe('_blank');
		expect(links[0]!.getAttribute('rel')).toBe('noopener noreferrer');
		expect(links[1]!.hasAttribute('target')).toBe(false);
		expect(links[2]!.hasAttribute('target')).toBe(false);
	});
});

test('target: every link gets it, _blank with rel noopener (spec 020, v-md of extensions)', () => {
	const links = (html: string) => {
		const template = document.createElement('template');
		template.innerHTML = html;
		return [...template.content.querySelectorAll('a')].map((a) => [a.target, a.rel]);
	};

	expect(links(md('[a](/x) [b](https://example.com)', { target: '_self' }))).toEqual([
		['_self', ''],
		['_self', ''],
	]);
	expect(links(md('[a](/x)', { target: '_blank' }))).toEqual([['_blank', 'noopener noreferrer']]);
});

// Spec 033 (FR-046): the sanitizer on its own, for HTML the documentation area builds.
describe('sanitize', () => {
	test('filters like md() does', () => {
		expect(sanitize('<p>Hi <script>alert(1)</script></p>')).toBe('<p>Hi </p>');
		expect(sanitize('<img src="x" onerror="alert(1)">')).toBe('<img src="x">');
	});

	test('keeps classes, data attributes and buttons; links to another origin open in a new tab', () => {
		const html = sanitize(
			'<pre tabindex="0"><code class="hljs language-json"><span class="hljs-attr">a</span></code></pre>' +
				'<button type="button" data-copy>Copy</button><a href="https://example.org/x">ext</a>',
		);

		expect(html).toContain('class="hljs-attr"');
		expect(html).toContain('tabindex="0"');
		expect(html).toContain('data-copy');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('rel="noopener noreferrer"');
	});
});
