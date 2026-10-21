// Backoffice: Directus has no unit test for cli/commands/schema/snapshot (spec 021 T049, FR-056).
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import inquirer from 'inquirer';
import { load as loadYaml } from 'js-yaml';
import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../../database/index.js';
import { useLogger } from '../../../logger/index.js';
import { getSnapshot } from '../../../utils/get-snapshot.js';
import { snapshot } from './snapshot.js';

vi.mock('inquirer');
vi.mock('../../../database/index.js');
vi.mock('../../../logger/index.js');
vi.mock('../../../utils/get-snapshot.js');

const SNAPSHOT = { version: 1, directus: '11.17.4', vendor: 'postgres', collections: [], fields: [], relations: [] };
const logger = { info: vi.fn(), error: vi.fn() };
const database = { destroy: vi.fn() };
let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;
let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'bo-snapshot-'));
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(database as any);
	vi.mocked(getSnapshot).mockResolvedValue(SNAPSHOT as any);
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	vi.clearAllMocks();
	exit.mockRestore();
	stdout.mockRestore();
	rmSync(dir, { recursive: true, force: true });
});

test('without a path, writes JSON or YAML to stdout', async () => {
	await snapshot(undefined, { yes: false, format: 'json' });
	expect(stdout).toHaveBeenCalledWith(JSON.stringify(SNAPSHOT));

	await snapshot(undefined, { yes: false, format: 'yaml' });
	expect(loadYaml(String(stdout.mock.calls[1]![0]))).toEqual(SNAPSHOT);
	expect(exit).toHaveBeenCalledWith(0);
});

test('writes a new file and logs its absolute path', async () => {
	const file = join(dir, 'snapshot.yaml');

	await snapshot(file, { yes: false, format: 'yaml' });

	expect(loadYaml(readFileSync(file, 'utf8'))).toEqual(SNAPSHOT);
	expect(logger.info).toHaveBeenCalledWith(`Snapshot saved to ${file}`);
	expect(inquirer.prompt).not.toHaveBeenCalled();
});

test('an existing file is overwritten only when the prompt says so, or with --yes', async () => {
	const file = join(dir, 'snapshot.json');
	writeFileSync(file, 'old');

	// The real process.exit ends the command here; the mock stops it the same way.
	exit.mockImplementationOnce(() => {
		throw new Error('exit');
	});
	vi.mocked(inquirer.prompt).mockResolvedValueOnce({ overwrite: false } as any);
	await snapshot(file, { yes: false, format: 'json' }).catch(() => undefined);
	expect(readFileSync(file, 'utf8')).toBe('old');
	expect(exit).toHaveBeenNthCalledWith(1, 0);

	vi.mocked(inquirer.prompt).mockResolvedValueOnce({ overwrite: true } as any);
	await snapshot(file, { yes: false, format: 'json' });
	expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(SNAPSHOT));

	writeFileSync(file, 'old');
	await snapshot(file, { yes: true, format: 'json' });
	expect(readFileSync(file, 'utf8')).toBe(JSON.stringify(SNAPSHOT));
	expect(inquirer.prompt).toHaveBeenCalledTimes(2);
});

test('an error is logged with exit code 1', async () => {
	const error = new Error('boom');
	vi.mocked(getSnapshot).mockRejectedValue(error);

	await snapshot(undefined, { yes: false, format: 'json' });

	expect(logger.error).toHaveBeenCalledWith(error);
	expect(database.destroy).toHaveBeenCalled();
	expect(exit).toHaveBeenCalledWith(1);
});
