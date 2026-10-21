import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { checkPackageNames } from './check-package-names.mjs';

function workspace(packages) {
	const root = mkdtempSync(join(tmpdir(), 'package-names-'));

	for (const [path, pkg] of Object.entries({ 'package.json': { name: 'backoffice' }, ...packages })) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), JSON.stringify(pkg));
	}

	return root;
}

test('passes with @backoffice/* names and allowed dependencies', () => {
	const root = workspace({
		'apps/api/package.json': { name: '@backoffice/api', dependencies: { '@backoffice/env': 'workspace:*' } },
		'apps/web/package.json': {
			name: '@backoffice/web',
			dependencies: { '@directus/sdk': '1.0.0', '@directus/utils': '1.0.0', '@directus/vue-split-panel': '1.0.0' },
			devDependencies: { '@directus/types': '1.0.0' },
		},
		'tests/parity/package.json': { name: '@backoffice/parity-tests' },
	});

	assert.deepEqual(checkPackageNames(root), { count: 4, errors: [] });
});

test('fails on a non-@backoffice name and on @directus/* dependencies (any field, root included)', () => {
	const root = workspace({
		'package.json': { name: 'backoffice', devDependencies: { '@directus/env': '1.0.0' } },
		'libs/env/package.json': { name: '@directus/env' },
		'libs/utils/package.json': { name: '@backoffice/utils', peerDependencies: { '@directus/utils': '*' } },
	});

	assert.deepEqual(checkPackageNames(root).errors, [
		'package.json: devDependencies must not use @directus/env',
		'libs/env/package.json: name "@directus/env" must start with @backoffice/',
		'libs/utils/package.json: peerDependencies must not use @directus/utils',
	]);
});

test('ignores folders without package.json', () => {
	const root = workspace({ 'libs/a/package.json': { name: '@backoffice/a' } });
	mkdirSync(join(root, 'libs/empty'));
	assert.equal(checkPackageNames(root).count, 2);
});

test('allows the extensions SDK in the fixture extensions workspace only', () => {
	const root = workspace({
		'tests/fixtures/extensions/package.json': {
			name: '@backoffice/extension-fixtures',
			devDependencies: { '@directus/extensions-sdk': '17.1.4' },
		},
		'apps/web/package.json': { name: '@backoffice/web', dependencies: { '@directus/composables': '11.4.1' } },
		'apps/api/package.json': { name: '@backoffice/api', dependencies: { '@directus/extensions-sdk': '17.1.4' } },
	});

	assert.deepEqual(checkPackageNames(root).errors, [
		'apps/api/package.json: dependencies must not use @directus/extensions-sdk',
	]);
});
