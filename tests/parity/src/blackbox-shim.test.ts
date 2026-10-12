// Feature 006 (T045, research R7): which app each URL of the blackbox shim names (@common/config of the port).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import config, {
	getSetupUrl,
	getStorages,
	getUrl,
	hasProfile,
	nodeUrl,
	paths,
} from './items/blackbox/common/config.js';

const URLS: Record<string, string> = {
	DIRECTUS_URL_BLACKBOX: 'http://d-blackbox',
	BACKOFFICE_URL_BLACKBOX: 'http://b-blackbox',
	DIRECTUS_URL_SCHEMA_CACHE: 'http://d-sc',
	BACKOFFICE_URL_SCHEMA_CACHE: 'http://b-sc',
	DIRECTUS_URL_SCHEMA_CACHE_NOMSG: 'http://d-nomsg',
	BACKOFFICE_URL_SCHEMA_CACHE_NOMSG: 'http://b-nomsg',
	DIRECTUS_URL_TZ_ASIA: 'http://d-asia',
	BACKOFFICE_URL_TZ_ASIA: 'http://b-asia',
	DIRECTUS_URL_TZ_AMERICA: 'http://d-america',
	BACKOFFICE_URL_TZ_AMERICA: 'http://b-america',
	DIRECTUS_URL_ASSETS_LIMIT: 'http://d-limit',
	BACKOFFICE_URL_ASSETS_LIMIT: 'http://b-limit',
};

const saved = { ...process.env };

beforeEach(() => {
	Object.assign(process.env, URLS);
	delete process.env['PARITY_BLACKBOX_APP'];
	delete process.env['PARITY_BLACKBOX_SETUP_APP'];
});

afterEach(() => {
	process.env = { ...saved };
});

const env = (values: Record<string, string>) =>
	({ postgres: { ...config.envs['postgres'], ...values } }) as unknown as typeof config.envs;

describe('blackbox shim (feature 006)', () => {
	test('getUrl: the app under test of the blackbox pair, or the node an env names by URL or TZ', () => {
		expect(getUrl('postgres')).toBe('http://b-blackbox');
		expect(getUrl('postgres', env({ URL: 'http://node' }))).toBe('http://node');
		expect(getUrl('postgres', env({ TZ: 'Asia/Seoul' }))).toBe('http://b-asia');
		expect(getUrl('postgres', env({ TZ: 'America/Sao_Paulo' }))).toBe('http://b-america');
		expect(() => getUrl('postgres', env({ TZ: 'Asia/Dubai' }))).toThrow('No parity profile for TZ=Asia/Dubai');

		process.env['PARITY_BLACKBOX_APP'] = 'directus';
		expect(getUrl('postgres')).toBe('http://d-blackbox');
		expect(getUrl('postgres', env({ TZ: 'America/Sao_Paulo' }))).toBe('http://d-america');
	});

	test('getSetupUrl: Directus of the pair unless PARITY_BLACKBOX_SETUP_APP=backoffice; the node of an env first', () => {
		expect(getSetupUrl('postgres')).toBe('http://d-blackbox');
		process.env['PARITY_BLACKBOX_SETUP_APP'] = 'backoffice';
		expect(getSetupUrl('postgres')).toBe('http://b-blackbox');
		expect(getSetupUrl('postgres', env({ URL: 'http://node' }))).toBe('http://node');
	});

	test('nodeUrl: node 1 is the app under test, node 2 the other app of the pair', () => {
		expect([nodeUrl('schema-cache', 1), nodeUrl('schema-cache', 2)]).toEqual(['http://b-sc', 'http://d-sc']);
		process.env['PARITY_BLACKBOX_APP'] = 'directus';
		expect([nodeUrl('schema-cache-nomsg', 1), nodeUrl('schema-cache-nomsg', 2)]).toEqual([
			'http://d-nomsg',
			'http://b-nomsg',
		]);
	});

	test('feature 007: storages from PARITY_STORAGES, the assets-limit node, the fixtures of the assets files', () => {
		process.env['PARITY_STORAGES'] = 's3';
		expect(getStorages()).toEqual(['s3']);
		delete process.env['PARITY_STORAGES'];
		expect(getStorages()).toEqual(['local', 's3']);
		expect([nodeUrl('assets-limit', 1), nodeUrl('assets-limit', 2)]).toEqual(['http://b-limit', 'http://d-limit']);
		expect(existsSync(join(paths.cwd, 'assets', 'directus.png'))).toBe(true);
	});

	test('hasProfile and the host databases', () => {
		expect(hasProfile('tz-asia')).toBe(true);
		delete process.env['DIRECTUS_URL_TZ_ASIA'];
		expect(hasProfile('tz-asia')).toBe(false);
		expect(config.knexConfig.postgres).toHaveProperty('client');
	});
});

test('sequencer: seed, the before list in order, other files by path, the after list in order', async () => {
	const { order } = await import('./items/blackbox/sequencer.js');

	expect(
		order([
			'/x/tests/db/routes/collections/schema-cache.test.ts',
			'/x/tests/db/routes/items/m2o.test.ts',
			'/x/tests/db/routes/fields/crud.test.ts',
			'/x/tests/db/schema/timezone/timezone.test.ts',
			'/x/00-seed.test.ts',
			'/x/tests/db/routes/items/m2a.test.ts',
			'/x/tests/db/routes/schema/schema.test.ts',
		]),
	).toEqual([
		'/x/00-seed.test.ts',
		'/x/tests/db/routes/schema/schema.test.ts',
		'/x/tests/db/routes/fields/crud.test.ts',
		'/x/tests/db/routes/items/m2a.test.ts',
		'/x/tests/db/routes/items/m2o.test.ts',
		'/x/tests/db/schema/timezone/timezone.test.ts',
		'/x/tests/db/routes/collections/schema-cache.test.ts',
	]);
});
