// Backoffice: Directus has no unit test for cli/commands/users (spec 021 T045, FR-050, FR-051).
import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import getDatabase from '../../../database/index.js';
import { useLogger } from '../../../logger/index.js';
import { getSchema } from '../../../schema/get-database-schema.js';
import { UsersService } from '../../../services/users.service.js';
import { generateHash } from '../../../utils/generate-hash.js';
import usersCreate from './create.js';
import usersPasswd from './passwd.js';

vi.mock('../../../database/index.js');
vi.mock('../../../logger/index.js');
vi.mock('../../../schema/get-database-schema.js');
vi.mock('../../../services/users.service.js');
vi.mock('../../../utils/generate-hash.js');

const logger = { info: vi.fn(), error: vi.fn() };
const database = { destroy: vi.fn() };
let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;

/** The knex calls of passwd: select ... whereRaw(...).first() and update(...).where(...). */
function knexStub(user: { id: string } | undefined) {
	const query = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		whereRaw: vi.fn().mockReturnThis(),
		first: vi.fn().mockResolvedValue(user),
	};

	const update = { update: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(1) };
	const knex = Object.assign(vi.fn().mockReturnValue(update), query);
	return { knex, query, update };
}

beforeEach(() => {
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(database as any);
	vi.mocked(getSchema).mockResolvedValue({} as any);
	vi.mocked(generateHash).mockResolvedValue('$argon2id$hash');
	// process.exit is called inside try/catch like Directus: the mock returns so each path runs to its end.
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	vi.clearAllMocks();
	exit.mockRestore();
	stdout.mockRestore();
});

describe('users create', () => {
	test.each([
		{ password: 'p', role: 'r' },
		{ email: 'a@example.com', role: 'r' },
		{ email: 'a@example.com', password: 'p' },
	])('a missing option is an error with exit code 1 (%o)', async (options) => {
		await usersCreate(options);
		expect(logger.error).toHaveBeenCalledWith('Email, password, role are required');
		expect(exit).toHaveBeenCalledWith(1);
	});

	test('creates an active user and prints its id', async () => {
		vi.mocked(UsersService.prototype.createOne).mockResolvedValue('user-1');

		await usersCreate({ email: 'a@example.com', password: 'p', role: 'role-1' });

		expect(UsersService.prototype.createOne).toHaveBeenCalledWith({
			email: 'a@example.com',
			password: 'p',
			role: 'role-1',
			status: 'active',
		});
		expect(stdout).toHaveBeenCalledWith('user-1\n');
		expect(database.destroy).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledWith(0);
	});

	test('a service error is logged with exit code 1', async () => {
		const error = new Error('Value for field "email" in collection "directus_users" has to be unique.');
		vi.mocked(UsersService.prototype.createOne).mockRejectedValue(error);

		await usersCreate({ email: 'a@example.com', password: 'p', role: 'role-1' });

		expect(logger.error).toHaveBeenCalledWith(error);
		expect(exit).toHaveBeenCalledWith(1);
	});
});

describe('users passwd', () => {
	test('a missing option is an error with exit code 1', async () => {
		await usersPasswd({ email: 'a@example.com' });
		expect(logger.error).toHaveBeenCalledWith('Email and password are required');
		expect(exit).toHaveBeenCalledWith(1);
	});

	test('finds the user by e-mail without case and stores the new hash', async () => {
		const { knex, query, update } = knexStub({ id: 'user-1' });
		vi.mocked(UsersService).mockImplementation(function (this: any) {
			this.knex = knex;
		} as any);

		await usersPasswd({ email: 'Admin@Example.com', password: 'new-password' });

		expect(generateHash).toHaveBeenCalledWith('new-password');
		expect(query.whereRaw).toHaveBeenCalledWith('LOWER(??) = ?', ['email', 'admin@example.com']);
		expect(knex).toHaveBeenCalledWith('directus_users');
		expect(update.update).toHaveBeenCalledWith({ password: '$argon2id$hash' });
		expect(update.where).toHaveBeenCalledWith({ id: 'user-1' });
		expect(logger.info).toHaveBeenCalledWith('Password is updated for user user-1');
		expect(exit).toHaveBeenCalledWith(0);
	});

	test('no user with that e-mail: error, exit code 1', async () => {
		const { knex, update } = knexStub(undefined);
		vi.mocked(UsersService).mockImplementation(function (this: any) {
			this.knex = knex;
		} as any);

		await usersPasswd({ email: 'nobody@example.com', password: 'p' });

		expect(update.update).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith('No such user by this email');
		expect(database.destroy).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledWith(1);
	});
});
