import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkPortHeaders } from './check-port-headers.mjs';

function workspace(files) {
	const root = mkdtempSync(join(tmpdir(), 'port-headers-'));

	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	return root;
}

const manifest = (entries) => ({ 'tools/port-manifest/T000.json': JSON.stringify(entries) });

test('passes with no manifest directory', () => {
	assert.deepEqual(checkPortHeaders(workspace({})), { count: 0, errors: [] });
});

test('passes when header names the source', () => {
	const root = workspace({
		'directus/api/src/a.ts': 'x',
		'apps/api/src/a.ts': '// Ported from directus/api/src/a.ts\nx',
		...manifest([{ source: 'api/src/a.ts', dest: 'apps/api/src/a.ts' }]),
	});

	assert.deepEqual(checkPortHeaders(root), { count: 1, errors: [] });
});

test('fails on missing header, missing dest, missing source', () => {
	const root = workspace({
		'directus/api/src/a.ts': 'x',
		'apps/api/src/a.ts': 'x',
		...manifest([
			{ source: 'api/src/a.ts', dest: 'apps/api/src/a.ts' },
			{ source: 'api/src/a.ts', dest: 'apps/api/src/missing.ts' },
			{ source: 'api/src/nope.ts', dest: 'apps/api/src/a.ts', header: false },
		]),
	});

	const { count, errors } = checkPortHeaders(root);
	assert.equal(count, 3);
	assert.equal(errors.length, 3);
	assert.match(errors[0], /first line must contain/);
	assert.match(errors[1], /does not exist/);
	assert.match(errors[2], /source directus\/api\/src\/nope.ts/);
});

test('header: false skips the first-line check only', () => {
	const root = workspace({
		'directus/.prettierrc.json': '{}',
		'.prettierrc.json': '{}',
		...manifest([{ source: '.prettierrc.json', dest: '.prettierrc.json', header: false }]),
	});

	assert.deepEqual(checkPortHeaders(root).errors, []);
});

test('reports invalid manifest JSON and non-array manifests', () => {
	const root = workspace({ 'tools/port-manifest/a.json': '{', 'tools/port-manifest/b.json': '{}' });
	const { errors } = checkPortHeaders(root);
	assert.equal(errors.length, 2);
});
