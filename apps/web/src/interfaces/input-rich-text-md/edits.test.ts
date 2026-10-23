// DR has no test for edits.ts: each alteration on a real CodeMirror 5 editor.
import CodeMirror from 'codemirror';
import { describe, expect, test } from 'vitest';
import { applyEdit } from './edits.ts';

function editor(value: string, from?: [number, number], to?: [number, number]) {
	const cm = CodeMirror(document.createElement('div'), { value });
	if (from) cm.setSelection({ line: from[0], ch: from[1] }, to ? { line: to[0], ch: to[1] } : undefined);
	return cm;
}

describe('applyEdit', () => {
	test('does nothing without an editor', () => {
		expect(() => applyEdit(null, 'bold')).not.toThrow();
	});

	test('inline wrappers toggle on the word at the cursor', () => {
		const cm = editor('some text', [0, 1]);
		applyEdit(cm, 'italic');
		expect(cm.getValue()).toBe('*some* text');

		const strike = editor('some text', [0, 6]);
		applyEdit(strike, 'strikethrough');
		expect(strike.getValue()).toBe('some ~~text~~');

		const bold = editor('**some**', [0, 0], [0, 8]);
		applyEdit(bold, 'bold');
		expect(bold.getValue()).toBe('some');
	});

	test('heading uses the level (3 by default) and toggles off', () => {
		const cm = editor('Title', [0, 0], [0, 5]);
		applyEdit(cm, 'heading');
		expect(cm.getValue()).toBe('### Title');

		const h1 = editor('# Title', [0, 0], [0, 7]);
		applyEdit(h1, 'heading', { level: 1 });
		expect(h1.getValue()).toBe('Title');
	});

	test('line prefixes: numbered list and blockquote on a multi-line selection', () => {
		const list = editor('a\nb', [0, 0], [1, 1]);
		applyEdit(list, 'listNumbered');
		expect(list.getValue()).toBe('1. a\n2. b');

		const quote = editor('a\nb', [0, 0], [1, 1]);
		applyEdit(quote, 'blockquote');
		expect(quote.getValue()).toBe('> a\n> b');
	});

	test('code is inline on one line and a fenced block on several', () => {
		const inline = editor('x', [0, 0], [0, 1]);
		applyEdit(inline, 'code');
		expect(inline.getValue()).toBe('`x`');

		const block = editor('a\nb', [0, 0], [1, 1]);
		applyEdit(block, 'code');
		expect(block.getValue()).toBe('```\na\nb\n```');
	});

	test('link: text gets an url placeholder, an url gets empty text', () => {
		const text = editor('site', [0, 0], [0, 4]);
		applyEdit(text, 'link');
		expect(text.getValue()).toBe('[site](url)');
		expect(text.getSelection()).toBe('url');

		const url = editor('https://example.com', [0, 0], [0, 19]);
		applyEdit(url, 'link');
		expect(url.getValue()).toBe('[](https://example.com)');
	});

	test('custom block syntax puts prefix and suffix on their own lines', () => {
		const cm = editor('body', [0, 0], [0, 4]);
		applyEdit(cm, 'custom', { name: 'Note', icon: 'info', prefix: ':::', suffix: ':::', box: 'block' });
		expect(cm.getValue()).toBe(':::\nbody\n:::');
	});
});
