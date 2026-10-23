// codemirror-theme.css: the line-number gutter stays opaque in dark mode, so text scrolled sideways does not show
// under it (Directus paints the gutter with a solid field color).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'codemirror-theme.css'), 'utf8').replace(/\s+/g, ' ');

test('the dark gutter mixes into gray-900, not into transparent', () => {
	expect(css).toMatch(
		/\.dark \.bo-codemirror \.CodeMirror-gutters \{ background: color-mix\(in oklab, var\(--color-white\) 3%, var\(--color-gray-900\)\);/,
	);
});
