// Ported from directus/api/src/cli/index.test.ts (wave 1 of spec 021: start, bootstrap, database; the other commands
// and their cases come with wave 2).
import { Command } from 'commander';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import emitter from '../emitter.js';
import { BACKOFFICE_VERSION } from '../version.js';
import bootstrap from './commands/bootstrap/index.js';
import dbInstall from './commands/database/install.js';
import dbMigrate from './commands/database/migrate.js';
import start from './commands/start.js';
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

vi.mock('./load-extensions.js', () => ({
	loadExtensions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/bootstrap/index.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/database/install.js', () => ({
	default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./commands/database/migrate.js', () => ({
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

		test('Backoffice name and version (D-147)', () => {
			expect(program.name()).toBe('backoffice');
			expect(program.usage()).toBe('[command] [options]');
			expect(program.version()).toBe(BACKOFFICE_VERSION);
		});
	});

	describe('Command actions', () => {
		test('Should call start when start command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'start']);

			expect(start).toHaveBeenCalledTimes(1);
		});

		test('Should call bootstrap when bootstrap command is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'bootstrap']);

			expect(bootstrap).toHaveBeenCalledTimes(1);
		});

		test('Should call dbInstall when database install is invoked', async () => {
			await program.parseAsync(['node', 'backoffice', 'database', 'install']);

			expect(dbInstall).toHaveBeenCalledTimes(1);
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
	});
});
