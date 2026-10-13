// Feature 008 (research R5): the helpers that start and stop a manual profile pair pass the right compose arguments.
import { beforeEach, expect, test, vi } from 'vitest';

const execFileSync = vi.fn(() => '');
vi.mock('node:child_process', () => ({ execFileSync }));

const { profileStop, profileUp } = await import('./docker.js');

beforeEach(() => {
	execFileSync.mockClear();
	process.env['TEST_DB'] = 'postgres';
});

const lastArgs = () => (execFileSync.mock.calls.at(-1) as unknown as [string, string[]])[1];

test('profileUp starts both containers of the pair and waits for their health checks', () => {
	profileUp('retention');

	const args = lastArgs();
	expect(args.slice(0, 3)).toEqual(['compose', '-p', 'parity-postgres']);
	expect(args).toContain('retention');
	expect(args.slice(-5)).toEqual(['up', '-d', '--wait', 'directus-retention', 'backoffice-api-retention']);
});

test('profileStop stops both containers of the pair', () => {
	profileStop('retention');

	expect(lastArgs().slice(-3)).toEqual(['stop', 'directus-retention', 'backoffice-api-retention']);
});

test('the scheduled flows pair is a profile of every compose call (feature 009)', () => {
	profileUp('flows-schedule');

	expect(lastArgs()).toContain('flows-schedule');
	expect(lastArgs().slice(-2)).toEqual(['directus-flows-schedule', 'backoffice-api-flows-schedule']);
});
