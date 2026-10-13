// Backoffice: Directus has no test for packages/utils/node/tmp.ts (spec 010 T002).
import { existsSync, statSync } from 'node:fs';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { createTmpFile } from './tmp.js';

afterEach(() => {
	vi.restoreAllMocks();
});

test('creates an empty file in its own directus-* directory under the OS temp directory', async () => {
	const file = await createTmpFile();

	expect(dirname(dirname(file.path))).toBe(tmpdir());
	expect(basename(dirname(file.path))).toMatch(/^directus-/);
	expect(basename(file.path)).toMatch(/^[0-9a-f]{8}$/);
	expect(statSync(file.path).size).toBe(0);

	await file.cleanup();
});

test('cleanup removes the file and its directory', async () => {
	const file = await createTmpFile();
	const dir = dirname(file.path);

	await file.cleanup();

	expect(existsSync(file.path)).toBe(false);
	expect(existsSync(dir)).toBe(false);
});

test('removes the directory and rethrows when the file cannot be created', async () => {
	const error = new Error('EACCES');
	const mkdtemp = vi.spyOn(fs, 'mkdtemp');
	vi.spyOn(fs, 'open').mockRejectedValueOnce(error);

	await expect(createTmpFile()).rejects.toBe(error);

	const dir = await mkdtemp.mock.results[0]!.value;
	expect(existsSync(dir)).toBe(false);
});
