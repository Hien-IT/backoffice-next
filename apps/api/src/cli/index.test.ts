// Ported from directus/api/src/cli/index.test.ts
import { Command } from 'commander';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import emitter from '../emitter.js';
import { BACKOFFICE_VERSION } from '../version.js';
import bootstrap from './commands/bootstrap/index.js';
import cacheClear from './commands/cache/clear.js';
import dbInstall from './commands/database/install.js';
import dbMigrate from './commands/database/migrate.js';
import init from './commands/init/index.js';
import { apply } from './commands/schema/apply.js';
import start from './commands/start.js';
import usersCreate from './commands/users/create.js';
import { loadExtensions } from './load-extensions.js';
import { createCli } from './index.js';

vi.mock('../emitter.js', () => ({
	default: {
		emitInit: vi.fn().mockResolvedValue(undefined),
	},
}));

vi.mock('./commands/start.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/database/install.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./load-extensions.js', () => ({
	loadExtensions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/bootstrap/index.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/cache/clear.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/database/migrate.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/init/index.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/schema/apply.js', () => ({
	apply: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/users/create.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

describe('createCli', () => {
	let program: Command;

	beforeEach(async () => {
		vi.clearAllMocks();
		program = await createCli();
	});

	describe('CLI initialization', () => {
		test('Should create a Command instance', async () => {
			expect(program).toBeInstanceOf(Command);
		});

		test('Should load extensions during initialization', async () => {
			expect(loadExtensions).toHaveBeenCalledTimes(1);
		});

		test('Should emit cli.before and cli.after events', async () => {
			expect(emitter.emitInit).toHaveBeenCalledWith('cli.before', { program: expect.any(Command) });
			expect(emitter.emitInit).toHaveBeenCalledWith('cli.after', { program: expect.any(Command) });
		});

		test('Should allow excess arguments', async () => {
			await program.parseAsync(['node', 'backoffice', 'start', 'test']);

			expect(program.args).toEqual(['start', 'test']);
		});
	});

	describe('Command actions', () => {
		test('Should call start when start command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'start']);

			expect(start).toHaveBeenCalledTimes(1);
		});

		test('Should call dbInstall when database install is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'database', 'install']);

			expect(dbInstall).toHaveBeenCalledTimes(1);
		});

		test('Should call init when init command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'init']);

			expect(init).toHaveBeenCalledTimes(1);
		});

		test('Should call bootstrap when bootstrap command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'bootstrap']);

			expect(bootstrap).toHaveBeenCalledTimes(1);
		});

		test('Should call cacheClear when cache clear command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'cache', 'clear']);

			expect(cacheClear).toHaveBeenCalledTimes(1);
		});

		test('Should pass --system flag to cacheClear', async () => {
			await program.parseAsync(['node', 'backoffice', 'cache', 'clear', '--system']);

			expect(cacheClear).toHaveBeenCalledWith(expect.objectContaining({ system: true }), expect.anything());
		});

		test('Should pass --data flag to cacheClear', async () => {
			await program.parseAsync(['node', 'backoffice', 'cache', 'clear', '--data']);

			expect(cacheClear).toHaveBeenCalledWith(expect.objectContaining({ data: true }), expect.anything());
		});

		test.each([
			['latest', 'migrate:latest'],
			['up', 'migrate:up'],
			['down', 'migrate:down'],
		])('Should call dbMigrate with "%s" argument', async (expectedArg, command) => {
			await program.parseAsync(['node', 'backoffice', 'database', command]);

			expect(dbMigrate).toHaveBeenCalledWith(expectedArg);
		});
	});

	describe('Command options', () => {
		test('Should parse command options correctly', async () => {
			await program.parseAsync(['node', 'backoffice', 'bootstrap', '--skipAdminInit']);

			expect(bootstrap).toHaveBeenCalledWith(
				expect.objectContaining({
					skipAdminInit: true,
				}),
				expect.anything(),
			);
		});

		test('Should parse multiple options for users create command', async () => {
			await program.parseAsync([
				'node',
				'directus',
				'users',
				'create',
				'--email',
				'test@example.com',
				'--password',
				'test123',
				'--role',
				'admin',
			]);

			expect(usersCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					email: 'test@example.com',
					password: 'test123',
					role: 'admin',
				}),
				expect.anything(),
			);
		});

		test('Should parse schema command arguments and options', async () => {
			await program.parseAsync(['node', 'backoffice', 'schema', 'apply', '--dry-run', './snapshot.yaml']);

			expect(apply).toHaveBeenCalledWith(
				'./snapshot.yaml',
				expect.objectContaining({
					dryRun: true,
				}),
				expect.anything(),
			);
		});
	});

	// Backoffice (spec 021 FR-040, FR-043, FR-044, D-147): the help of every command and commander's errors.
	describe('Help and errors', () => {
		const commands = (command: Command): Command[] => command.commands.flatMap((c) => [c, ...commands(c)]);

		test('Backoffice name and version (D-147)', () => {
			expect(program.name()).toBe('backoffice');
			expect(program.usage()).toBe('[command] [options]');
			expect(program.version()).toBe(BACKOFFICE_VERSION);
		});

		test('the help of the program and of each command', () => {
			const help = [program, ...commands(program)].map((c) => c.helpInformation()).join('\n----\n');
			expect(help).toMatchSnapshot();
		});

		test.each([
			[['nope'], 'commander.unknownCommand', "error: unknown command 'nope'"],
			[['bootstrap', '--nope'], 'commander.unknownOption', "error: unknown option '--nope'"],
			[['count'], 'commander.missingArgument', "error: missing required argument 'collection'"],
			[
				['schema', 'snapshot', '--format', 'xml'],
				'commander.invalidArgument',
				"error: option '--format <format>' argument 'xml' is invalid. Allowed choices are json, yaml.",
			],
		])('%j fails like Directus (%s)', async (args, code, message) => {
			const errors: string[] = [];

			for (const command of [program, ...commands(program)]) {
				command.exitOverride().configureOutput({ writeErr: (text) => errors.push(text), writeOut: () => {} });
			}

			await expect(program.parseAsync(['node', 'backoffice', ...args])).rejects.toMatchObject({ code, exitCode: 1 });
			expect(errors.join('')).toContain(message);
		});
	});
});
