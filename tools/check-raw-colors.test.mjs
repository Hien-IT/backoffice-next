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

test('passes with token utilities, CSS variables, the token file, tests and opted-out lines', () => {
	const root = workspace({
		'apps/web/src/A.vue':
			'<div class="bg-eh-action-primary text-eh-text-primary p-eh-4" />\n<a href="#main-content" />',
		'apps/web/src/b.css': '.x { color: var(--eh-color-text-primary); }',
		'apps/web/src/styles/tokens.css': ':root { --eh-color-blue-500: #1890ff; }',
		'apps/web/src/c.test.ts': "const color = '#ff0000';",
		'apps/web/src/d.ts': "ctx.fillStyle = '#ffffff'; // raw-color-allowed: canvas logo color",
	});

	assert.deepEqual(checkRawColors(root), { count: 3, errors: [] });
});

test('fails on hex, rgb(), hsl() and palette classes', () => {
	const root = workspace({
		'apps/web/src/A.vue': '<div class="bg-gray-100" />\n<p class="text-white" />',
		'apps/web/src/b.css': '.x { color: #fff; }\n.y { background: rgba(0, 0, 0, 0.5); }',
		'apps/web/src/c.ts': "const c = 'hsl(0 0% 0%)';",
	});

	assert.deepEqual(checkRawColors(root).errors, [
		'apps/web/src/A.vue:1: Tailwind palette class "bg-gray-100"',
		'apps/web/src/A.vue:2: Tailwind palette class "text-white"',
		'apps/web/src/b.css:1: hex color "#fff"',
		'apps/web/src/b.css:2: rgb()/hsl() color "rgba("',
		'apps/web/src/c.ts:1: rgb()/hsl() color "hsl("',
	]);
});
