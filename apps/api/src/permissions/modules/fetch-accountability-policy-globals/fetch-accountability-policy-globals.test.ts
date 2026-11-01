// Ported from directus/api/src/permissions/modules/fetch-accountability-policy-globals/fetch-accountability-policy-globals.test.ts
import type { Accountability } from '@backoffice/types';
import type { Knex } from 'knex';
import { beforeEach, expect, test, vi } from 'vitest';
import { fetchPolicies } from '../../lib/fetch-policies.js';
import { fetchAccountabilityPolicyGlobals } from './fetch-accountability-policy-globals.js';

vi.mock('../../lib/fetch-policies.js');

let knex: Knex;

beforeEach(() => {
	vi.clearAllMocks();

	knex = {
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		whereIn: vi.fn().mockReturnThis(),
		first: vi.fn(),
	} as unknown as Knex;
});

test('Return enforce_tfa true if a policy with enforce_tfa is found', async () => {
	vi.mocked(knex.first).mockResolvedValue({});
	vi.mocked(fetchPolicies).mockResolvedValue(['policy-a']);

	const result = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: '' } as unknown as Accountability,
		{ knex } as any,
	);

	expect(result).toEqual({ app_access: true, admin_access: false, enforce_tfa: true });
	expect(knex.whereIn).toHaveBeenCalledWith('id', ['policy-a']);
});

test('Return enforce_tfa false if no policy with enforce_tfa is found', async () => {
	vi.mocked(knex.first).mockResolvedValue(undefined);
	vi.mocked(fetchPolicies).mockResolvedValue(['policy-a']);

	const result = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: '' } as unknown as Accountability,
		{ knex } as any,
	);

	expect(result).toEqual({ app_access: true, admin_access: false, enforce_tfa: false });
	expect(knex.whereIn).toHaveBeenCalledWith('id', ['policy-a']);
});

// Backoffice (spec 029, D-207.5, research R13): a session a passkey login created answers enforce_tfa false.
test('policy with enforce_tfa and a passkey session → enforce_tfa false', async () => {
	vi.mocked(knex.first).mockResolvedValueOnce({}).mockResolvedValueOnce({ bo_passkey: true });
	vi.mocked(fetchPolicies).mockResolvedValue(['policy-a']);

	const result = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: 'u', session: 'session-token' } as unknown as Accountability,
		{ knex } as any,
	);

	expect(result).toEqual({ app_access: true, admin_access: false, enforce_tfa: false });
	expect(knex.from).toHaveBeenCalledWith('directus_sessions');
	expect(knex.where).toHaveBeenCalledWith({ token: 'session-token' });
});

test('policy with enforce_tfa and a password session (bo_passkey null) → enforce_tfa true', async () => {
	vi.mocked(knex.first).mockResolvedValueOnce({}).mockResolvedValueOnce({ bo_passkey: null });
	vi.mocked(fetchPolicies).mockResolvedValue(['policy-a']);

	const result = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: 'u', session: 'session-token' } as unknown as Accountability,
		{ knex } as any,
	);

	expect(result.enforce_tfa).toBe(true);
});

test('no session (JSON token, static token) or no enforcing policy → no directus_sessions lookup', async () => {
	vi.mocked(fetchPolicies).mockResolvedValue(['policy-a']);

	vi.mocked(knex.first).mockResolvedValueOnce({});
	const noSession = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: 'u' } as unknown as Accountability,
		{ knex } as any,
	);

	vi.mocked(knex.first).mockResolvedValueOnce(undefined);
	const notEnforced = await fetchAccountabilityPolicyGlobals(
		{ app: true, admin: false, roles: [], user: 'u', session: 'session-token' } as unknown as Accountability,
		{ knex } as any,
	);

	expect(noSession.enforce_tfa).toBe(true);
	expect(notEnforced.enforce_tfa).toBe(false);
	expect(knex.from).not.toHaveBeenCalledWith('directus_sessions');
});
