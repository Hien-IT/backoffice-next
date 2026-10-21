import { afterEach, expect, test, vi } from 'vitest';
import { startServer } from '../../server.js';
import { runStartupChecks } from '../../startup/run-startup-checks.js';
import { logUnhandledRejections } from '../../unhandled-rejection.js';
import start from './start.js';

vi.mock('../../server.js', () => ({ startServer: vi.fn() }));
vi.mock('../../startup/run-startup-checks.js');
vi.mock('../../unhandled-rejection.js');

afterEach(() => vi.clearAllMocks());

test('same order as src/main.ts: rejection logger, startup checks, then the server', async () => {
	const calls: string[] = [];
	vi.mocked(logUnhandledRejections).mockImplementation(() => void calls.push('rejections'));
	vi.mocked(runStartupChecks).mockImplementation(async () => void calls.push('checks'));
	vi.mocked(startServer).mockImplementation(async () => (calls.push('server'), {} as any));

	await start();

	expect(calls).toEqual(['rejections', 'checks', 'server']);
});

test('a failing startup check never starts the server', async () => {
	vi.mocked(runStartupChecks).mockRejectedValue(new Error('config'));

	await expect(start()).rejects.toThrow('config');
	expect(startServer).not.toHaveBeenCalled();
});
