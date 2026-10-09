import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';
import { spec } from '../index.js';

/** The rebranding applied to the YAML (titles, summaries, descriptions; never examples, directus_*, @directus/*). */
function rebrand(value: unknown, key?: string): unknown {
	if (typeof value === 'string') return key === 'example' ? value : value.replace(/(?<![\w@/])Directus(?![\w_])/g, 'Backoffice');
	if (Array.isArray(value)) return value.map((v) => rebrand(v));
	if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v, k)]));
	return value;
}

function directusSpec(): unknown | undefined {
	try {
		const json = execFileSync(
			'docker',
			['run', '--rm', '--entrypoint', 'cat', 'directus/directus:11.17.4', '/directus/node_modules/.pnpm/@directus+specs@file+packages+specs/node_modules/@directus/specs/dist/openapi.json'],
			{ encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
		);

		return JSON.parse(json);
	} catch {
		return undefined;
	}
}

test('bundled spec is rebranded', () => {
	expect(spec.info.title).toBe('Backoffice');
	expect(spec.openapi).toBe('3.0.1');
	// Directus' spec does not pass `swagger-cli validate` either; parity with it is what matters here.
	const left: string[] = [];

	const walk = (value: unknown, key?: string): void => {
		if (typeof value === 'string' && key !== 'example' && /(?<![\w@/])Directus(?![\w_])/.test(value)) left.push(value);
		else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, k);
	};

	walk(spec);
	expect(left).toEqual([]);
});

describe('equals the spec of directus/directus:11.17.4 after the same rebranding', () => {
	const original = directusSpec();

	test.skipIf(original === undefined)('identical structure and text', () => {
		expect(spec).toEqual(rebrand(original));
	});
});
