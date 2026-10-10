import type { Knex } from 'knex';
import { authenticator } from 'otplib';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createAuthDb } from '../../test/directus-db.js';
import { TFAService } from './tfa.service.js';

let db: Knex;
const id = 'd0000000-0000-4000-8000-000000000001';

beforeEach(async () => {
	db = await createAuthDb();
});

afterEach(() => db.destroy());

const service = () => new TFAService({ knex: db, schema: { collections: {}, relations: [] } });

describe('generateTFA', () => {
	test('returns a base32 secret and an otpauth URL with the project name as issuer', async () => {
		await db('directus_users').insert({ id, email: 'a@example.com' });
		await db('directus_settings').insert({ project_name: 'Acme' });

		const { secret, url } = await service().generateTFA(id);

		expect(secret).toMatch(/^[A-Z2-7]+$/);
		expect(url).toBe(authenticator.keyuri('a@example.com', 'Acme', secret!));
	});

	test('uses "Backoffice" when project_name is empty (D-25), and external_identifier without email', async () => {
		await db('directus_users').insert({ id, provider: 'oidc', external_identifier: 'sub-1' });
		await db('directus_settings').insert({ project_name: '' });

		const { secret, url } = await service().generateTFA(id, false);
		expect(url).toBe(authenticator.keyuri('sub-1', 'Backoffice', secret!));
	});

	test('rejects users with TFA, local users without email, and the OAuth-only method for local users', async () => {
		await db('directus_users').insert({ id, email: null });
		await expect(service().generateTFA(id)).rejects.toMatchObject({ code: 'INVALID_PAYLOAD' });

		await db('directus_users').where({ id }).update({ email: 'b@example.com' });
		await expect(service().generateTFA(id, false)).rejects.toThrow('only available for OAuth users');

		await db('directus_users').where({ id }).update({ tfa_secret: 'X' });
		await expect(service().generateTFA(id)).rejects.toThrow('TFA Secret is already set');
	});
});

describe('verifyOTP', () => {
	test('checks the OTP against the stored or the given secret', async () => {
		const secret = authenticator.generateSecret();
		await db('directus_users').insert({ id, email: 'c@example.com', tfa_secret: secret });

		expect(await service().verifyOTP(id, authenticator.generate(secret))).toBe(true);
		expect(await service().verifyOTP(id, '000000')).toBe(false);
		expect(await service().verifyOTP('x', authenticator.generate(secret), secret)).toBe(true);
	});

	test('throws when the user has no TFA', async () => {
		await db('directus_users').insert({ id, email: 'd@example.com' });
		await expect(service().verifyOTP(id, '123456')).rejects.toThrow(`User "${id}" doesn't have TFA enabled`);
	});
});
