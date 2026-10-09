import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { changedDirectusFiles } from './guard-directus-unchanged.mjs';

const SCRIPT = fileURLToPath(new URL('./guard-directus-unchanged.mjs', import.meta.url));

function repo() {
	const root = mkdtempSync(join(tmpdir(), 'guard-directus-'));
	const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
	git('init', '-q', '-b', 'main');
	git('config', 'user.email', 'test@example.com');
	git('config', 'user.name', 'test');
	commit(root, { 'directus/api/a.ts': 'a', 'apps/api/b.ts': 'b' });
	git('checkout', '-q', '-b', 'feature');
	return root;
}

function commit(root, files) {
	for (const [path, content] of Object.entries(files)) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}

	execFileSync('git', ['add', '-A'], { cwd: root });
	execFileSync('git', ['commit', '-q', '-m', 'c'], { cwd: root });
}

const run = (root) => {
	try {
		execFileSync('node', [SCRIPT, 'main'], { cwd: root, stdio: 'pipe' });
		return 0;
	} catch (error) {
		return error.status;
	}
};

test('passes when only files outside directus/ change', () => {
	const root = repo();
	commit(root, { 'apps/api/b.ts': 'changed', 'directus-notes.md': 'x' });
	assert.deepEqual(changedDirectusFiles('main', root), []);
	assert.equal(run(root), 0);
});

test('fails when a file under directus/ changes, is added or deleted', () => {
	const root = repo();
	commit(root, { 'directus/api/a.ts': 'changed', 'directus/new.ts': 'n' });
	assert.deepEqual(changedDirectusFiles('main', root), ['directus/api/a.ts', 'directus/new.ts']);
	assert.equal(run(root), 1);
});

test('ignores changes made on the base branch after the fork point', () => {
	const root = repo();
	execFileSync('git', ['checkout', '-q', 'main'], { cwd: root });
	commit(root, { 'directus/api/a.ts': 'upstream update' });
	execFileSync('git', ['checkout', '-q', 'feature'], { cwd: root });
	assert.equal(run(root), 0);
});
