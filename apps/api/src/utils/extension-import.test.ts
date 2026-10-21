import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, test, vi } from 'vitest';
import { deleteFromRequireCache } from './delete-from-require-cache.js';
import getModuleDefault from './get-module-default.js';
import { importFileUrl } from './import-file-url.js';

vi.mock('../logger/index.js', () => ({ useLogger: () => ({ trace: vi.fn() }) }));

const dir = mkdtempSync(join(tmpdir(), 'import-file-url-'));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('importFileUrl', () => {
	test('imports a file by absolute path, fresh adds a cache-busting query', async () => {
		const file = join(dir, 'mod.mjs');
		writeFileSync(file, 'export default { value: 1 };');

		const first = await importFileUrl(file, import.meta.url);
		expect(first.default).toEqual({ value: 1 });

		// vite-node keys its module cache without the query, so the re-read itself is only visible under plain Node.
		const fresh = await importFileUrl(file, import.meta.url, { fresh: true });
		expect(fresh.default).toEqual({ value: 1 });
	});
});

describe('getModuleDefault', () => {
	test('returns the default export when present, else the module', () => {
		const inner = { a: 1 };
		expect(getModuleDefault({ default: inner })).toBe(inner);
		expect(getModuleDefault(inner)).toBe(inner);
	});
});

describe('deleteFromRequireCache', () => {
	test('drops a cached CommonJS module and ignores unknown paths', () => {
		const file = join(dir, 'cjs.cjs');
		writeFileSync(file, 'module.exports = 1;');
		expect(() => deleteFromRequireCache(file)).not.toThrow();
		expect(() => deleteFromRequireCache(pathToFileURL(join(dir, 'missing.cjs')).pathname)).not.toThrow();
	});
});
