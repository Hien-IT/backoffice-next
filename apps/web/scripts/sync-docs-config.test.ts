// Spec 033 T036 (FR-033, FR-051, research R8): the generated list of environment variables matches the API sources.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { DISPLAY_DEFAULTS, loadSources, OUT, renderSupported, unlistedDefaults } from './sync-docs-config.mjs';

test('renders names, patterns and defaults', () => {
	const json = JSON.parse(
		renderSupported(
			[/^PORT$/, /^DB_.+$/, /^CONFIG_PATH$/, /^SECRET$/, /^CORS_METHODS$/],
			{ PORT: 8055, CONFIG_PATH: '/home/me/.env', CORS_METHODS: ['GET', 'POST'], TUS_ENABLED: false, EMAIL_FROM: 'a@b.c' },
			[/^EMAIL_FROM$/],
		),
	);

	expect(json.$source).toContain('sync-docs-config.mjs');
	expect(json.variables).toEqual([
		{ pattern: 'PORT', exact: true, default: '8055' },
		{ pattern: 'DB_.+', exact: false },
		// A default that depends on the machine is shown as documented, not as resolved here.
		{ pattern: 'CONFIG_PATH', exact: true, default: DISPLAY_DEFAULTS.CONFIG_PATH },
		{ pattern: 'SECRET', exact: true },
		{ pattern: 'CORS_METHODS', exact: true, default: 'GET,POST' },
		// Read by the API, in neither list: added. EMAIL_FROM is a listed variable the API does not support: left out.
		{ pattern: 'TUS_ENABLED', exact: true, default: 'false' },
	]);
});

test('unlistedDefaults: names with a default that neither list matches', () => {
	expect(unlistedDefaults([/^A$/], { A: 1, B: 2, C: 3 }, [/^C$/])).toEqual(['B']);
});

test('the committed file is what the script writes now', async () => {
	const { patterns, defaults, listed } = await loadSources();
	const fresh = renderSupported(patterns, defaults, listed);

	expect(readFileSync(OUT, 'utf8')).toBe(fresh);
	expect(JSON.parse(fresh).variables.find((v: { pattern: string }) => v.pattern === 'CONFIG_PATH').default).toBe('.env');
});
