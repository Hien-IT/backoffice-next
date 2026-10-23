// Backoffice: DR has no test for utils/create-admin.ts (spec 010 T011).
import { useEnv } from '@backoffice/env';
import { SchemaBuilder } from '@backoffice/schema-builder';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AccessService } from '../services/access.service.js';
import { PoliciesService } from '../services/policies.service.js';
import { RolesService } from '../services/roles.service.js';
import { UsersService } from '../services/users.service.js';
import { createAdmin, defaultAdminPolicy, defaultAdminRole, defaultAdminUser } from './create-admin.js';

vi.mock('@backoffice/env');
vi.mock('../logger/index.js', () => ({ useLogger: () => ({ info: vi.fn() }) }));
vi.mock('../services/access.service.js');
vi.mock('../services/policies.service.js');
vi.mock('../services/roles.service.js');
vi.mock('../services/users.service.js');

const schema = new SchemaBuilder().build();
const calls: string[] = [];

beforeEach(() => {
	vi.mocked(useEnv).mockReturnValue({});
	vi.mocked(RolesService.prototype.createOne).mockImplementation(async () => (calls.push('role'), 'role-1'));
	vi.mocked(PoliciesService.prototype.createOne).mockImplementation(async () => (calls.push('policy'), 'policy-1'));
	vi.mocked(AccessService.prototype.createOne).mockImplementation(async () => (calls.push('access'), 1));
	vi.mocked(UsersService.prototype.createOne).mockImplementation(async () => (calls.push('user'), 'user-1'));
});

afterEach(() => {
	calls.length = 0;
	vi.clearAllMocks();
});

test('creates the role, the policy, the access and the user in that order, without accountability', async () => {
	await createAdmin(schema, { email: 'owner@example.com', password: 'secret', first_name: 'A', last_name: 'B' });

	expect(calls).toEqual(['role', 'policy', 'access', 'user']);
	expect(RolesService.prototype.createOne).toHaveBeenCalledWith(defaultAdminRole);
	expect(PoliciesService.prototype.createOne).toHaveBeenCalledWith(defaultAdminPolicy);
	expect(AccessService.prototype.createOne).toHaveBeenCalledWith({ policy: 'policy-1', role: 'role-1' });
	expect(vi.mocked(RolesService).mock.calls[0]![0]).toEqual({ schema });

	expect(UsersService.prototype.createOne).toHaveBeenCalledWith({
		...defaultAdminUser,
		first_name: 'A',
		last_name: 'B',
		email: 'owner@example.com',
		password: 'secret',
		token: null,
		role: 'role-1',
	});
});

test('falls back to ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_TOKEN and the default names', async () => {
	vi.mocked(useEnv).mockReturnValue({ ADMIN_EMAIL: 'env@example.com', ADMIN_PASSWORD: 'pw', ADMIN_TOKEN: 'tok' });

	await createAdmin(schema);

	expect(UsersService.prototype.createOne).toHaveBeenCalledWith({
		status: 'active',
		first_name: 'Admin',
		last_name: 'User',
		email: 'env@example.com',
		password: 'pw',
		token: 'tok',
		role: 'role-1',
	});
});

test.each([
	['no email', { password: 'secret' }],
	['no password', { email: 'owner@example.com' }],
	['empty email (an empty project_owner does not fall back)', { email: '', password: 'secret' }],
])('%s: the role, policy and access are created but no user', async (_label, admin) => {
	await createAdmin(schema, admin);

	expect(calls).toEqual(['role', 'policy', 'access']);
	expect(UsersService.prototype.createOne).not.toHaveBeenCalled();
});
