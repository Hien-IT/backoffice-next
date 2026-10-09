import type { Knex } from 'knex';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createDirectusDb } from '../../test/directus-db.js';
import { PROJECT_FIELDS, SettingsService } from './settings.service.js';

vi.mock('../logger/index.js', () => ({ useLogger: () => ({ warn: vi.fn(), trace: vi.fn() }) }));
vi.mock('@backoffice/env', () => ({ useEnv: () => ({}) }));

let db: Knex;

beforeEach(async () => {
	db = await createDirectusDb();
});

afterEach(() => db.destroy());

describe('readProjectInfo (readSingleton of directus_settings)', () => {
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

		const project = await new SettingsService({ knex: db }).readProjectInfo();
		expect(Object.keys(project)).toEqual([...PROJECT_FIELDS, 'public_background']);
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
		expect((await new SettingsService({ knex: db }).readProjectInfo())['public_background']).toBe(null);
		await db('directus_settings').update({ public_background: null });
		expect((await new SettingsService({ knex: db }).readProjectInfo())['public_background']).toBe(null);
	});

	test('first row by id when there are several', async () => {
		await db('directus_settings').insert([
			{ id: 2, project_name: 'second' },
			{ id: 1, project_name: 'first' },
		]);
		expect((await new SettingsService({ knex: db }).readProjectInfo())['project_name']).toBe('first');
	});

	test('no settings row → non-null column defaults of the requested fields, in schema order', async () => {
		const project = await new SettingsService({ knex: db }).readProjectInfo();

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
