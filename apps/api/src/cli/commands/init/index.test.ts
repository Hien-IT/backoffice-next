// Backoffice: Directus has no unit test for cli/commands/init (spec 021 T059, FR-030..FR-032, D-146, D-147). The
// prompts are answered by a mocked inquirer; seeds, migrations and the admin rows go to a real SQLite file. Migration
// 20251014A reads the schema through the global database (DB_* env), as in Directus, so the env points at that file
// like the DB_* defaults of the image do.
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import inquirer from 'inquirer';
import knex from 'knex';
import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest';
import { DIRECTUS_MIGRATIONS } from '../../../database/migrations/directus-11.17.4.js';
import init from './index.js';

const ENV_DB = await vi.hoisted(async () => {
	const { mkdtempSync } = await import('node:fs');
	const { tmpdir } = await import('node:os');
	const filename = `${mkdtempSync(`${tmpdir()}/bo-init-env-`)}/data.db`;
	process.env['DB_CLIENT'] = 'sqlite3';
	process.env['DB_FILENAME'] = filename;
	return filename;
});

vi.mock('inquirer');

// Under Node the default import of knex is module.exports, which has `.default` (create-db-connection.ts calls
// `knex.default` like Directus); Vitest's interop gives the bare function.
vi.mock('knex', async (importOriginal) => {
	const original = await importOriginal<any>();
	original.default.default ??= original.default;
	return original;
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class Exit extends Error {}

let dir: string;
let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;
const questions: any[][] = [];

/** Answers the prompts in order: client, then credentials (once per attempt), then the first admin. */
function answer(...answers: Record<string, unknown>[]) {
	vi.mocked(inquirer.prompt).mockImplementation((async (asked: any[]) => {
		questions.push(asked);
		return answers.shift();
	}) as any);
}

const output = () => stdout.mock.calls.map((call) => String(call[0])).join('');

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'bo-init-'));
	vi.spyOn(process, 'cwd').mockReturnValue(dir);
	exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
		throw new Exit(String(code));
	}) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
	questions.length = 0;
});

afterEach(() => {
	vi.restoreAllMocks();
	rmSync(dir, { recursive: true, force: true });
});

test('SQLite: installs the database, writes .env and the first admin, prints the Backoffice start command', async () => {
	const filename = ENV_DB;
	writeFileSync(join(dir, '.env'), 'OLD=1\n');
	answer({ client: 'SQLite' }, { filename }, { email: ' admin@example.com ', password: 'init-password' });

	await expect(init()).rejects.toEqual(new Exit('0'));

	// D-146: only the vendors Backoffice installs, Directus' labels.
	expect(questions[0]![0]).toMatchObject({
		type: 'list',
		name: 'client',
		choices: ['PostgreSQL / Redshift', 'SQLite'],
	});
	expect(questions[1]!.map((q) => q.name)).toEqual(['filename']);
	expect(questions[1]![0].default).toBe(join(dir, 'data.db'));

	// .env from the template (overwritten), 0640, no port header.
	const env = readFileSync(join(dir, '.env'), 'utf8');
	expect(env).not.toContain('OLD=1');
	expect(env).not.toContain('Ported from');
	expect(env).toContain('core settings of Backoffice');
	expect(env).toMatch(/^SECRET="[A-Za-z0-9_-]{32}"$/m);
	expect(env).toContain('DB_CLIENT="sqlite3"');
	expect(env).toContain(`DB_FILENAME="${filename}"`);
	expect(statSync(join(dir, '.env')).mode & 0o777).toBe(0o640);

	const db = knex.default({ client: 'sqlite3', connection: { filename }, useNullAsDefault: true });

	try {
		const versions = (await db('directus_migrations').select('version')).map((r) => r.version).sort();
		expect(versions).toEqual([...DIRECTUS_MIGRATIONS].sort());

		const [user] = await db('directus_users').select('*');
		const access = await db('directus_access').where({ role: user.role }).first();
		expect(user.email).toBe('admin@example.com');
		expect(user.id).toMatch(UUID);
		expect(user.password).toMatch(/^\$argon2/);
		expect(access).toMatchObject({ role: user.role });
		expect(await db('directus_roles').where({ id: user.role }).first()).toMatchObject({ name: 'Administrator' });
		expect(await db('directus_policies').where({ id: access.policy }).first()).toMatchObject({ admin_access: 1 });
		expect(await db('directus_settings').select('project_name')).toEqual([{ project_name: 'Backoffice' }]);
	} finally {
		await db.destroy();
	}

	const [email, password] = questions[2]!;
	expect(email.default).toBe('admin@example.com');
	expect(() => email.validate('not an email')).toThrow('The email entered is not a valid email address!');
	expect(email.validate(' a@example.com ')).toBe(true);
	expect(() => password.validate('')).toThrow('The password cannot be empty!');
	expect(password).toMatchObject({ type: 'password', mask: '*' });

	expect(output()).toContain('Start Backoffice by running:');
	expect(output()).toContain('node cli.js');
	expect(output()).not.toContain('npx directus');
}, 120_000);

test('Postgres asks the Directus questions', async () => {
	answer({ client: 'PostgreSQL / Redshift' });
	await init().catch(() => undefined);
	expect(questions[1]!.map((q) => q.name)).toEqual(['host', 'port', 'database', 'user', 'password', 'ssl']);
	expect(questions[1]![1].default()).toBe(5432);
});

test('five failed attempts: Directus messages, then exit 1', async () => {
	const missing = { filename: join(dir, 'missing', 'data.db') };
	answer({ client: 'SQLite' }, missing, missing, missing, missing, missing);

	await expect(init()).rejects.toEqual(new Exit('1'));

	expect(questions).toHaveLength(6);
	expect(output().match(/Something went wrong while seeding the database:/g)).toHaveLength(5);
	expect(output()).toContain("Couldn't seed the database. Exiting.");
	expect(existsSync(join(dir, '.env'))).toBe(false);
	expect(exit).toHaveBeenCalledWith(1);
});
