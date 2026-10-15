// Feature 014 (CHK097): every static translation key of the Content module screens exists in en-US (generated
// translations or the Backoffice overlay), so no screen shows a raw key. Dynamic keys (`t(x)`) are not checked here: the
// E2E fixture fails on the missing-key warning instead.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import enUSOverlay from './overlay/en-US.ts';
import enUS from './translations/en-US.json';

const SRC = join(import.meta.dirname, '..');
const DIRS = [
	'modules/content',
	'layouts',
	'components/sidebar',
	'components/comparison',
	'interfaces/_system',
	// Feature 015.
	'modules/files',
	'modules/users',
	'components/files',
];
// `$t('key'`, `t('key'`, `te('key'`, `keypath="key"`: the first argument when it is a plain string literal.
const KEY = /(?:\$t|\bt|\bte|\btc)\(\s*(['"`])([\w.-]+)\1|keypath="([\w.-]+)"/g;

function files(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { recursive: true, encoding: 'utf8' })
		.filter((f) => /\.(vue|ts)$/.test(f) && !/\.test\.ts$/.test(f))
		.map((f) => join(dir, f));
}

export function staticKeys(source: string): string[] {
	return [...source.matchAll(KEY)].map((m) => (m[2] ?? m[3])!);
}

function has(key: string): boolean {
	let node: unknown = { ...enUS, ...enUSOverlay };

	for (const part of key.split('.')) {
		if (typeof node !== 'object' || node === null || !(part in node)) return false;
		node = (node as Record<string, unknown>)[part];
	}

	return typeof node === 'string';
}

test('staticKeys finds the literal keys only', () => {
	expect(staticKeys(`$t('a') t("b.c") te('d') t(x) keypath="e" format('f')`)).toEqual(['a', 'b.c', 'd', 'e']);
});

test('static keys of the Content module screens exist in en-US', () => {
	const missing = DIRS.flatMap((dir) => files(join(SRC, dir))).flatMap((file) =>
		staticKeys(readFileSync(file, 'utf8'))
			.filter((key) => !has(key))
			.map((key) => `${file.slice(SRC.length + 1)}: ${key}`),
	);

	expect(missing).toEqual([]);
});
