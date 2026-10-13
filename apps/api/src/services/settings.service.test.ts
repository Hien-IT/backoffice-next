// SettingsService of feature 010 extends ItemsService like Directus (research R2). The /server/info cases of feature 001
// keep guarding the output of readSingleton with the field list of ServerService.serverInfo.
import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createInspector } from '@backoffice/schema';
import { createDirectusDb } from '../../test/directus-db.js';
import { getDatabaseSchema } from '../schema/get-database-schema.js';
import { ItemsService } from './items.service.js';
import { SettingsService } from './settings.service.js';

const logger = vi.hoisted(() => ({ warn: vi.fn(), trace: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../logger/index.js', () => ({ useLogger: () => logger }));
vi.mock('@backoffice/env', () => ({ useEnv: () => ({}) }));

const PROJECT_FIELDS = [
	'project_name',
	'project_descriptor',
	'project_logo',
	'project_color',
	'default_appearance',
	'default_theme_light',
	'default_theme_dark',
	'theme_light_overrides',
	'theme_dark_overrides',
	'default_language',
	'public_foreground',
	'public_favicon',
	'public_note',
	'custom_css',
	'public_registration',
	'public_registration_verify_email',
];

/** The query of ServerService.serverInfo (directus/api/src/services/server.ts:45-66). */
const SERVER_INFO_FIELDS = [
	...PROJECT_FIELDS.slice(0, 11),
	'public_background.id',
	'public_background.type',
	...PROJECT_FIELDS.slice(11),
];

let db: Knex;

beforeEach(async () => {
	db = await createDirectusDb();
	vi.clearAllMocks();
});

afterEach(() => db.destroy());

async function service() {
	return new SettingsService({ knex: db, schema: await getDatabaseSchema(db, createInspector(db)) });
}

const readProjectInfo = async () => (await service()).readSingleton({ fields: SERVER_INFO_FIELDS });

test('SettingsService is the ItemsService of directus_settings', async () => {
	const settings = await service();
	expect(settings).toBeInstanceOf(ItemsService);
	expect(settings.collection).toBe('directus_settings');
});

describe('readSingleton with the fields of /server/info (feature 001)', () => {
	test('17 keys in order, casts applied, public_background resolved to {id, type}', async () => {
		await db('directus_files').insert({ id: 'f0000000-0000-4000-8000-000000000001', type: 'image/png' });

		await db('directus_settings').insert({
			project_name: 'P',
			public_registration: 1,
			public_registration_verify_email: '0',
			theme_light_overrides: '{"primary":"#f00","__proto__":{"x":1}}',
			theme_dark_overrides: '{bad',
			public_background: 'f0000000-0000-4000-8000-000000000001',
		});

		const project = await readProjectInfo();
		expect(Object.keys(project).sort()).toEqual([...PROJECT_FIELDS, 'public_background'].sort());
		expect(project).toMatchObject({
			project_name: 'P',
			project_color: '#6644FF',
			public_registration: true,
			public_registration_verify_email: false,
			theme_light_overrides: { primary: '#f00' },
			theme_dark_overrides: '{bad',
			public_background: { id: 'f0000000-0000-4000-8000-000000000001', type: 'image/png' },
		});
	});

	test('public_background pointing to a missing file → null; no file → null', async () => {
		await db('directus_settings').insert({ public_background: 'f0000000-0000-4000-8000-00000000dead' });
		expect((await readProjectInfo())['public_background']).toBe(null);
		await db('directus_settings').update({ public_background: null });
		expect((await readProjectInfo())['public_background']).toBe(null);
	});

	test('first row by id when there are several', async () => {
		await db('directus_settings').insert([
			{ id: 2, project_name: 'second' },
			{ id: 1, project_name: 'first' },
		]);
		expect((await readProjectInfo())['project_name']).toBe('first');
	});

	test('no settings row → non-null column defaults of the requested fields, in schema order', async () => {
		const project = await readProjectInfo();

		expect(project).toEqual({
			project_name: 'Directus',
			project_color: '#6644FF',
			default_appearance: 'auto',
			default_language: 'en-US',
			public_registration: false,
			public_registration_verify_email: true,
		});
	});
});

describe('readSingleton (feature 003)', () => {
	test('reads auth settings like ItemsService.readSingleton, with the schema defaults without a row', async () => {
		const { createAuthDb } = await import('../../test/directus-db.js');
		const authDb = await createAuthDb();
		const schema = await getDatabaseSchema(authDb, createInspector(authDb));
		const service = new SettingsService({ knex: authDb, schema });

		expect(await service.readSingleton({ fields: ['auth_login_attempts'] })).toEqual({ auth_login_attempts: 25 });

		await authDb('directus_settings').insert({ auth_login_attempts: 3, auth_password_policy: '/^.{8,}$/' });

		expect(await service.readSingleton({ fields: ['auth_login_attempts', 'auth_password_policy'] })).toEqual({
			auth_login_attempts: 3,
			auth_password_policy: '/^.{8,}$/',
		});

		await authDb.destroy();
	});
});

describe('setOwner (spec 010 FR-012, D-38)', () => {
	test('upserts the owner fields with project_status null, no request out, one warning without the owner email', async () => {
		const settings = await service();
		const upsert = vi.spyOn(ItemsService.prototype, 'upsertSingleton').mockResolvedValue(1);
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		await expect(
			settings.setOwner({
				project_owner: 'owner@example.com',
				project_usage: 'commercial',
				org_name: 'Parity Org',
				product_updates: true,
			}),
		).resolves.toBe(1);

		expect(upsert).toHaveBeenCalledWith({
			project_owner: 'owner@example.com',
			project_usage: 'commercial',
			org_name: 'Parity Org',
			product_updates: true,
			project_status: null,
		});

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledOnce();
		expect(logger.warn.mock.calls[0]![0]).toBe(
			'Backoffice: owner report is out of scope; project owner for Parity Org not reported',
		);
		expect(logger.warn.mock.calls[0]![0]).not.toContain('owner@example.com');
		upsert.mockRestore();
	});

	test('no org name → "(no org)"; extra fields of the body (POST /server/setup) are not written', async () => {
		const settings = await service();
		const upsert = vi.spyOn(ItemsService.prototype, 'upsertSingleton').mockResolvedValue(1);

		await settings.setOwner({
			project_owner: 'a@b.c',
			project_usage: null,
			org_name: null,
			product_updates: false,
			password: 'secret',
		} as any);

		expect(Object.keys(upsert.mock.calls[0]![0])).toEqual([
			'project_owner',
			'project_usage',
			'org_name',
			'product_updates',
			'project_status',
		]);
		expect(logger.warn.mock.calls[0]![0]).toContain('for (no org) not reported');
		upsert.mockRestore();
	});
});
