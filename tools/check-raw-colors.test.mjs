import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkRawColors } from './check-raw-colors.mjs';

function workspace(files) {
	const root = mkdtempSync(join(tmpdir(), 'raw-colors-'));

	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	return root;
}

test('passes with theme utilities, CSS variables, the theme file, tests and opted-out lines', () => {
	const root = workspace({
		'apps/web/src/A.vue':
			'<div class="bg-brand-500 text-gray-700 dark:text-white/90 bg-blue-light-50 text-white p-4" />\n<a href="#main-content" />',
		'apps/web/src/b.css': '.x { color: var(--color-gray-800); }',
		'apps/web/src/styles/theme.css': '@theme { --color-brand-500: #465fff; }',
		'apps/web/src/c.test.ts': "const color = '#ff0000';",
		'apps/web/src/d.ts': "ctx.fillStyle = '#ffffff'; // raw-color-allowed: canvas logo color",
	});

	assert.deepEqual(checkRawColors(root), { count: 3, errors: [] });
});

test('fails on hex, rgb(), hsl() and palette classes', () => {
	const root = workspace({
		'apps/web/src/A.vue': '<div class="bg-red-100" />\n<p class="text-sky-500" />',
		'apps/web/src/b.css': '.x { color: #fff; }\n.y { background: rgba(0, 0, 0, 0.5); }',
		'apps/web/src/c.ts': "const c = 'hsl(0 0% 0%)';",
	});

	assert.deepEqual(checkRawColors(root).errors, [
		'apps/web/src/A.vue:1: Tailwind palette class "bg-red-100"',
		'apps/web/src/A.vue:2: Tailwind palette class "text-sky-500"',
		'apps/web/src/b.css:1: hex color "#fff"',
		'apps/web/src/b.css:2: rgb()/hsl() color "rgba("',
		'apps/web/src/c.ts:1: rgb()/hsl() color "hsl("',
	]);
});
