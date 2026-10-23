// Backoffice: DR has no unit test for cli/commands/security (spec 021 T048, FR-055).
import { type MockInstance, afterEach, beforeEach, expect, test, vi } from 'vitest';
import generateKey from './key.js';
import generateSecret from './secret.js';

let exit: MockInstance<typeof process.exit>;
let stdout: MockInstance<typeof process.stdout.write>;

beforeEach(() => {
	exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
	stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
	exit.mockRestore();
	stdout.mockRestore();
});

test('key:generate prints a uuid without a newline and exits 0', async () => {
	await generateKey();
	expect(stdout.mock.calls[0]![0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	expect(exit).toHaveBeenCalledWith(0);
});

test('secret:generate prints 32 url-safe characters without a newline and exits 0', async () => {
	await generateSecret();
	expect(stdout.mock.calls[0]![0]).toMatch(/^[A-Za-z0-9_-]{32}$/);
	expect(exit).toHaveBeenCalledWith(0);
});
