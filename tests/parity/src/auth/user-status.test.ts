// Feature 003, US4.1, US4.2, FR-042: only active users of the provider log in; a static token of a user that is not
// active is refused. Failed logins write nothing but the shared counter, so the same request goes to both apps.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertParity, parity } from '../parity.js';
import { cleanupFixtures, createUser, PASSWORD, type User } from './fixtures.js';
import { post } from './flows.js';

const statuses = ['invited', 'draft', 'suspended', 'archived'] as const;
const users: Record<string, User> = {};
const STATIC = `parity-status-${Date.now()}`;

beforeAll(async () => {
	for (const status of statuses) {
		users[status] = await createUser(`status-${status}`, { status, token: `${STATIC}-${status}` });
	}

	users['sso'] = await createUser('status-sso', { provider: 'oidc', external_identifier: `sub-${Date.now()}` });
}, 60_000);

afterAll(cleanupFixtures, 60_000);

async function expectParity(req: Parameters<typeof parity>[0], status: number, code: string) {
	const result = await parity(req);
	assertParity(result);
	expect(result.directus.status).toBe(status);
	expect((result.directus.json as any).errors[0].extensions.code).toBe(code);
}

describe('user status (US4.1)', () => {
	it.each(statuses)('%s: login 401 INVALID_CREDENTIALS', async (status) => {
		await expectParity(
			post('/auth/login', { email: users[status]!.email, password: PASSWORD }),
			401,
			'INVALID_CREDENTIALS',
		);
	});

	it.each(statuses)('%s: static token 401 INVALID_CREDENTIALS (FR-042)', async (status) => {
		const req = {
			...post('/users/me/tfa/generate', { password: PASSWORD }),
			headers: { authorization: `Bearer ${STATIC}-${status}` },
		};
		await expectParity(req, 401, 'INVALID_CREDENTIALS');
	});
});

it('a user of another provider at /auth/login: 401 (US4.2)', async () => {
	await expectParity(
		post('/auth/login', { email: users['sso']!.email, password: PASSWORD }),
		401,
		'INVALID_CREDENTIALS',
	);
});
