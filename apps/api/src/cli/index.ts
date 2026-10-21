// Ported from directus/api/src/cli/index.ts
import { Command } from 'commander';
import emitter from '../emitter.js';
import { BACKOFFICE_VERSION } from '../version.js';
import bootstrap from './commands/bootstrap/index.js';
import dbInstall from './commands/database/install.js';
import dbMigrate from './commands/database/migrate.js';
import start from './commands/start.js';
import { loadExtensions } from './load-extensions.js';

export async function createCli(): Promise<Command> {
	const program = new Command();
	program.allowExcessArguments();

	await loadExtensions();

	await emitter.emitInit('cli.before', { program });

	// Backoffice (spec 021 D-147): program name and version; the commands keep the Directus names and options.
	program.name('backoffice').usage('[command] [options]');
	program.version(BACKOFFICE_VERSION, '-v, --version');

	program.command('start').description('Start the Backoffice API').action(start);

	const dbCommand = program.command('database');
	dbCommand.command('install').description('Install the database').action(dbInstall);

	dbCommand
		.command('migrate:latest')
		.description('Upgrade the database')
		.action(() => dbMigrate('latest'));

	dbCommand
		.command('migrate:up')
		.description('Upgrade the database')
		.action(() => dbMigrate('up'));

	dbCommand
		.command('migrate:down')
		.description('Downgrade the database')
		.action(() => dbMigrate('down'));

	program
		.command('bootstrap')
		.description('Initialize or update the database')
		.option('--skipAdminInit', 'Skips the creation of the default Admin Role and User')
		.action(bootstrap);

	await emitter.emitInit('cli.after', { program });

	return program;
}
