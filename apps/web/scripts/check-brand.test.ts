import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';
import { checkBrand, stripComments } from './check-brand.mjs';

function src(files: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), 'check-brand-'));

	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	return root;
}

test('comments, tests and lowercase identifiers are fine', () => {
	const root = src({
		'a.ts': "// Ported from directus/app/src/a.ts (Directus)\nconst url = 'https://docs.directus.io'; // like Directus",
		'B.vue': "<!-- Ported from Directus -->\n<template><p>{{ $t('x') }}</p></template>",
		'c.css': '/* Directus look */ .a {}',
		'd.test.ts': "expect('Directus')",
		'e.ts': "import { createDirectus, type DirectusClient } from '@directus/sdk';",
		'f.ts': "/*\n multi\n*/\nconst x = name === 'Directus'; // brand-allowed: data",
	});

	expect(checkBrand(root)).toEqual([]);
});

test('visible strings fail', () => {
	const root = src({ 'a.ts': "export const NAME = 'Directus';", 'B.vue': '<template><h1>Directus</h1></template>' });

	expect(checkBrand(root)).toEqual([
		"a.ts:1: export const NAME = 'Directus';",
		'B.vue:1: <template><h1>Directus</h1></template>',
	]);
});

test('JSON data is checked, except the generated theme data and the translations (015 D-88, D-89)', () => {
	const root = src({
		'theme/theme-presets.json': '{ "id": "Directus Default" }',
		'lang/translations/en-US.json': '{ "theme_directus_default": "Directus Default" }',
		'theme/other.json': '{ "id": "Directus Default" }',
		'nested/theme/theme-presets.json': '{ "id": "Directus Default" }',
	});

	expect(checkBrand(root)).toEqual([
		'nested/theme/theme-presets.json:1: { "id": "Directus Default" }',
		'theme/other.json:1: { "id": "Directus Default" }',
	]);
});

// Spec 033 (FR-047, research R9): the documentation content.
test('Markdown and YAML are read as they are; lowercase identifiers stay fine', () => {
	const root = src({
		'docs/a.md': 'Bảng `directus_files`, gói `@directus/sdk`, cookie `directus_session_token`.',
		'docs/b.md': '# Title\n\nLike Directus does.',
		'docs/c.md': '```bash\ncurl https://x // Directus\n```',
		'docs/d.yaml': 'description: Directus keeps this',
		'docs/e.yml': 'summary: List files # directus_files',
	});

	expect(checkBrand(root)).toEqual([
		'docs/b.md:3: Like Directus does.',
		'docs/c.md:2: curl https://x // Directus',
		'docs/d.yaml:1: description: Directus keeps this',
	]);
});

test('stripComments keeps URLs', () => {
	expect(stripComments("a('http://x') // c")).toBe("a('http://x') ");
});

test('the app source has no visible Directus', () => {
	expect(checkBrand(join(import.meta.dirname, '../src'))).toEqual([]);
});
