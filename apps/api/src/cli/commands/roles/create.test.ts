// Backoffice: Directus has no unit test for cli/commands/roles (spec 021 T046, FR-052).
import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../../database/index.js';
import { useLogger } from '../../../logger/index.js';
import { getSchema } from '../../../schema/get-database-schema.js';
import { AccessService, PoliciesService } from '../../../services/index.js';
import { RolesService } from '../../../services/roles.service.js';
import rolesCreate from './create.js';

vi.mock('../../../database/index.js');
vi.mock('../../../logger/index.js');
vi.mock('../../../schema/get-database-schema.js');
vi.mock('../../../services/index.js', () => ({
	AccessService: vi.fn(function (this: any) {
		this.createOne = vi.fn();
	}),
	PoliciesService: vi.fn(function (this: any) {
		this.createOne = vi.fn().mockResolvedValue('policy-1');
	}),
}));
vi.mock('../../../services/roles.service.js');

const logger = { error: vi.fn() };
const database = { destroy: vi.fn() };
let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;

const created = (service: any) => vi.mocked(service).mock.instances[0].createOne;

beforeEach(() => {
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(database as any);
	vi.mocked(getSchema).mockResolvedValue({} as any);
	vi.mocked(RolesService.prototype.createOne).mockResolvedValue('role-1');
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	vi.clearAllMocks();
	exit.mockRestore();
	stdout.mockRestore();
});

test('a missing name is an error with exit code 1', async () => {
	await rolesCreate({ role: '', admin: false, app: false });
	expect(logger.error).toHaveBeenCalledWith('Name is required');
	expect(exit).toHaveBeenCalledWith(1);
});

test('creates the policy, the role and their access row, then prints the role id', async () => {
	await rolesCreate({ role: 'Editors', admin: true, app: true });

	expect(created(PoliciesService)).toHaveBeenCalledWith({
		name: 'Policy for Editors',
		admin_access: true,
		app_access: true,
		icon: 'supervised_user_circle',
	});
	expect(RolesService.prototype.createOne).toHaveBeenCalledWith({ name: 'Editors' });
	expect(created(AccessService)).toHaveBeenCalledWith({ role: 'role-1', policy: 'policy-1' });
	expect(stdout).toHaveBeenCalledWith('role-1\n');
	expect(database.destroy).toHaveBeenCalledOnce();
	expect(exit).toHaveBeenCalledWith(0);
});

test('a service error is logged with exit code 1', async () => {
	const error = new Error('boom');
	vi.mocked(RolesService.prototype.createOne).mockRejectedValue(error);

	await rolesCreate({ role: 'Editors', admin: false, app: true });

	expect(logger.error).toHaveBeenCalledWith(error);
	expect(exit).toHaveBeenCalledWith(1);
});
