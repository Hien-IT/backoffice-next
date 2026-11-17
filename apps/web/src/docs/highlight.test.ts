// Spec 033 T009 (FR-010a, research R6).
import { describe, expect, test } from 'vitest';
import { escapeHtml, highlight } from './highlight.ts';

describe('highlight', () => {
	test('bash, json and graphql get hljs classes', () => {
		expect(highlight('curl "https://x" # c', 'bash')).toContain('<span class="hljs-string">');
		expect(highlight('{"a": 1}', 'json')).toContain('<span class="hljs-attr">');
		expect(highlight('query { files { id } }', 'graphql')).toContain('<span class="hljs-keyword">query</span>');
	});

	test('an unknown or missing language gives escaped text and no error', () => {
		expect(highlight('<b>"x" & y</b>', 'cobol')).toBe('&lt;b&gt;&quot;x&quot; &amp; y&lt;/b&gt;');
		expect(highlight('<i>', undefined)).toBe('&lt;i&gt;');
		expect(highlight('<i>', null)).toBe('&lt;i&gt;');
		expect(escapeHtml('a < b')).toBe('a &lt; b');
	});

	test('code is escaped inside a known language too', () => {
		expect(highlight('{"a": "<img onerror=x>"}', 'json')).not.toContain('<img');
	});
});
