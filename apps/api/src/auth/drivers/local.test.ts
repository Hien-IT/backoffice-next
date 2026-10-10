import argon2 from 'argon2';
import knex from 'knex';
import { createTracker, MockClient } from 'knex-mock-client';
import { describe, expect, test } from 'vitest';
import type { User } from '../../types/index.js';
import { LocalAuthDriver } from './local.js';

const db = knex({ client: MockClient });
const tracker = createTracker(db);
const driver = new LocalAuthDriver({ knex: db }, {});

describe('LocalAuthDriver', () => {
	test('getUserID looks the email up without case and rejects unknown users', async () => {
		tracker.on.select('directus_users').responseOnce({ id: 'u' });
		expect(await driver.getUserID({ email: 'A@Example.com' })).toBe('u');
		expect(tracker.history.select[0]!.bindings).toContain('a@example.com');

		tracker.on.select('directus_users').responseOnce(undefined);
		await expect(driver.getUserID({ email: 'x@example.com' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		await expect(driver.getUserID({})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
	});

	test('login verifies the argon2 password', async () => {
		const user = { password: await argon2.hash('secret') } as User;
		await expect(driver.login(user, { password: 'secret' })).resolves.toBeUndefined();
		await expect(driver.login(user, { password: 'wrong' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
		await expect(driver.verify({ password: null } as User, 'x')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
	});
});
