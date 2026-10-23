// Backoffice: DR has no unit test for cli/commands/count (spec 021 T048, FR-054).
import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest';
import getDatabase from '../../../database/index.js';
import { useLogger } from '../../../logger/index.js';
import count from './index.js';

vi.mock('../../../database/index.js');
vi.mock('../../../logger/index.js');

const logger = { error: vi.fn() };
const counted = vi.fn();
const database = Object.assign(
	vi.fn(() => ({ count: counted })),
	{ destroy: vi.fn() },
);
let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;

beforeEach(() => {
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(getDatabase).mockReturnValue(database as any);
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	vi.clearAllMocks();
	exit.mockRestore();
	stdout.mockRestore();
});

test('a missing collection is an error with exit code 1', async () => {
	counted.mockResolvedValue([{ count: 0 }]);
	await count('');
	expect(logger.error).toHaveBeenCalledWith('Collection is required');
	expect(exit).toHaveBeenCalledWith(1);
});

test('prints the row count as a number (string counts of Postgres included)', async () => {
	counted.mockResolvedValue([{ count: '42' }]);

	await count('articles');

	expect(database).toHaveBeenCalledWith('articles');
	expect(counted).toHaveBeenCalledWith('*', { as: 'count' });
	expect(stdout).toHaveBeenCalledWith('42\n');
	expect(exit).toHaveBeenCalledWith(0);
});

test('an unknown table is logged with exit code 1', async () => {
	const error = new Error('relation "nope" does not exist');
	counted.mockRejectedValue(error);

	await count('nope');

	expect(logger.error).toHaveBeenCalledWith(error);
	expect(database.destroy).toHaveBeenCalledOnce();
	expect(exit).toHaveBeenCalledWith(1);
});
