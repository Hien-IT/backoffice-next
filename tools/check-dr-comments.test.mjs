import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkDrComments } from './check-dr-comments.mjs';

// A workspace outside git, so every file is checked.
function workspace(files) {
	const root = mkdtempSync(join(tmpdir(), 'dr-comments-'));
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}
	return root;
}

test('a comment that names Directus fails, with its file and line', () => {
	const root = workspace({ 'apps/web/src/a.ts': 'const a = 1;\n// as in Directus\n' });
	assert.deepEqual(checkDrComments(root).errors, [
		'apps/web/src/a.ts:2: write "DR" instead of "Directus" in a comment',
	]);
});

test('strings, identifiers and @directus imports are not comments; DR comments pass', () => {
	const root = workspace({
		'apps/api/src/b.ts':
			"import { x } from '@directus/types';\nclass DirectusError {}\nconst s = 'Directus';\n// as in DR\n",
		'apps/web/src/c.vue':
			'<template><p>Directus</p><!-- the DR app --></template>\n<script setup lang="ts">\n// DR\n</script>\n',
	});
	assert.deepEqual(checkDrComments(root).errors, []);
});

test('Vue template, style and script comments, CSS, HTML and Dockerfile comments are checked', () => {
	const root = workspace({
		'apps/web/src/d.vue':
			'<template><!-- Directus --></template>\n<style>/* Directus */</style>\n<script>/* Directus */</script>\n',
		'apps/web/src/e.css': '/* Directus */\n',
		'apps/web/index.html': '<!-- Directus -->\n',
		'apps/api/Dockerfile': '# Directus image\nFROM node\n',
	});
	assert.equal(checkDrComments(root).errors.length, 6);
});

test('the verbatim migration and seed ports keep their Directus comments', () => {
	const root = workspace({
		'apps/api/src/database/migrations/20201028A-x.ts': '// Directus\n',
		'apps/api/src/database/seeds/run.ts': '// Directus\n',
	});
	assert.deepEqual(checkDrComments(root).errors, []);
});
