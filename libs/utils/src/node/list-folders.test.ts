// Ported from directus/packages/utils/node/list-folders.test.ts
// Backoffice: node:fs mkdtemp instead of the `tmp` package; adds the ignoreHidden case.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listFolders } from './list-folders.js';

describe('listFolders', () => {
	let rootDir: string;

	beforeEach(() => {
		rootDir = mkdtempSync(path.join(tmpdir(), 'list-folders-'));
		mkdirSync(path.join(rootDir, 'child'));
		mkdirSync(path.join(rootDir, '.hidden'));
		writeFileSync(path.join(rootDir, 'file.txt'), '');
	});

	afterEach(() => {
		rmSync(rootDir, { recursive: true, force: true });
	});

	it('returns all the subdirectories of the current directory', async () => {
		expect((await listFolders(rootDir)).sort()).toStrictEqual(['.hidden', 'child']);
	});

	it('skips hidden folders with ignoreHidden', async () => {
		expect(await listFolders(rootDir, { ignoreHidden: true })).toStrictEqual(['child']);
	});
});
