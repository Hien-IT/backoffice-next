import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { BUDGET_013, entrySize, LIMIT, lazyLeaks } from './check-bundle.mjs';

function dist(js: string) {
	const root = mkdtempSync(join(tmpdir(), 'check-bundle-'));
	mkdirSync(join(root, 'assets'));
	writeFileSync(join(root, 'assets/index-abc.js'), js);
	writeFileSync(
		join(root, 'index.html'),
		'<html><head><script type="module" crossorigin src="/admin/assets/index-abc.js"></script></head></html>',
	);
	return root;
}

test('measures the gzipped entry chunk named in index.html', () => {
	const { file, gzip } = entrySize(dist('console.log(1);'.repeat(1000)));

	expect(file.endsWith('assets/index-abc.js')).toBe(true);
	expect(gzip).toBeGreaterThan(0);
	expect(gzip).toBeLessThan(LIMIT);
});

test('fails without a module script', () => {
	const root = mkdtempSync(join(tmpdir(), 'check-bundle-'));
	writeFileSync(join(root, 'index.html'), '<html></html>');

	expect(() => entrySize(root)).toThrow('no module script');
});

test('feature 013 budget is below the 012 limit and finds lazy-only libraries in the entry', () => {
	expect(BUDGET_013).toBeLessThan(LIMIT);

	const root = dist('const a = "maplibre-gl"; const b = 1;');
	expect(lazyLeaks(join(root, 'assets/index-abc.js'))).toEqual(['maplibre-gl']);
	expect(lazyLeaks(join(dist('console.log(1);'), 'assets/index-abc.js'))).toEqual([]);
});
