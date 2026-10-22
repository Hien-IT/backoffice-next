import { useEnv } from '@backoffice/env';
import { type MockInstance, beforeEach, describe, expect, test, vi } from 'vitest';
import { warnSingleInstance } from '../config/warn-single-instance.js';
import { warnUnsupportedVariables } from '../config/warn-unsupported-variables.js';
import { isInstalled, validateDatabaseConnection, validateDatabaseExtensions } from '../database/index.js';
import { validateMigrations } from '../database/validate-migrations.js';
import { useLogger } from '../logger/index.js';
import { validateStorage } from '../utils/validate-storage.js';
import { VERSION_LOG_LINE } from '../version.js';
import { runStartupChecks } from './run-startup-checks.js';
import { validateStorageDrivers } from './validate-storage-drivers.js';
import { registerAuthProviders } from '../auth.js';

vi.mock('@backoffice/env');
vi.mock('../config/warn-single-instance.js');
vi.mock('../config/warn-unsupported-variables.js');
vi.mock('../database/index.js');
vi.mock('../database/validate-migrations.js');
vi.mock('../logger/index.js');
vi.mock('../utils/validate-storage.js');
vi.mock('./validate-storage-drivers.js');
vi.mock('../auth.js');

const order: string[] = vi.hoisted(() => []);

// Loading these modules validates the rate limiter configuration (row 6).
vi.mock('../middleware/rate-limiter-global.js', () => (order.push('rate-limiter-global'), { default: vi.fn() }));
vi.mock('../middleware/rate-limiter-ip.js', () => (order.push('rate-limiter-ip'), { default: vi.fn() }));

const logger = {
	info: vi.fn((m: string) => order.push(`info ${m}`)),
	warn: vi.fn((m: string) => order.push(`warn ${m}`)),
	error: vi.fn((m: string) => order.push(`error ${m}`)),
};

let env: Record<string, unknown>;
let exit: MockInstance<typeof process.exit>;

beforeEach(() => {
	vi.clearAllMocks();
	order.splice(0);
	env = { SECRET: 'a-secret-that-is-longer-than-32-bytes!!', PUBLIC_URL: 'https://example.com' };
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockImplementation(() => (order.push('env'), env));
	vi.mocked(warnUnsupportedVariables).mockImplementation(() => void order.push('unsupported'));
	vi.mocked(warnSingleInstance).mockImplementation(() => void order.push('single-instance'));
	vi.mocked(validateDatabaseConnection).mockImplementation(async () => void order.push('db'));
	vi.mocked(isInstalled).mockImplementation(async () => (order.push('installed'), true));
	vi.mocked(validateMigrations).mockImplementation(async () => void order.push('migrations'));
	vi.mocked(validateDatabaseExtensions).mockImplementation(async () => void order.push('extensions'));
	vi.mocked(validateStorageDrivers).mockImplementation(() => void order.push('storage-drivers'));
	vi.mocked(validateStorage).mockImplementation(async () => void order.push('storage'));
	vi.mocked(registerAuthProviders).mockImplementation(async () => void order.push('auth-providers'));
	exit = vi
		.spyOn(process, 'exit')
		.mockImplementation(((code: number) => (order.push(`exit ${code}`), undefined)) as never);
});

test('runs the steps in the order of contracts/startup.md §1', async () => {
	await runStartupChecks();

	expect(order).toEqual([
		'env',
		`info ${VERSION_LOG_LINE}`,
		'unsupported',
		'single-instance',
		'rate-limiter-global',
		'rate-limiter-ip',
		'db',
		'installed',
		'migrations',
		'extensions',
		'storage-drivers',
		'storage',
		'auth-providers',
	]);
});

test('a configuration error stops before anything else', async () => {
	vi.mocked(useEnv).mockImplementation(() => {
		throw new SyntaxError('Invalid regular expression: /(/: Unterminated group');
	});

	await expect(runStartupChecks()).rejects.toThrow(SyntaxError);
	expect(order).toEqual([]);
});

test('Directus not installed → error and exit 1 (row 10)', async () => {
	vi.mocked(isInstalled).mockResolvedValue(false);
	await runStartupChecks();
	expect(order).toContain("error Database doesn't have Directus tables installed.");
	expect(exit).toHaveBeenCalledWith(1);
});

describe('SECRET and PUBLIC_URL warnings (rows 12–13), verbatim Directus plus one [new] line', () => {
	test('missing SECRET', async () => {
		env = { PUBLIC_URL: 'https://example.com' };
		await runStartupChecks();
		expect(logger.warn.mock.calls.map(([m]) => m)).toEqual([
			'"SECRET" env variable is missing. Using a random value instead. Tokens will not persist between restarts. This is not appropriate for production usage.',
			'Tokens signed with this random SECRET will not be accepted by the other apps on this database.',
		]);
	});

	test('short SECRET', async () => {
		env = { SECRET: 'short', PUBLIC_URL: 'https://example.com' };
		await runStartupChecks();
		expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
			'"SECRET" env variable is shorter than 32 bytes which is insecure. This is not appropriate for production usage.',
		);
	});

	test('relative PUBLIC_URL', async () => {
		env = { SECRET: 'a-secret-that-is-longer-than-32-bytes!!', PUBLIC_URL: '/' };
		await runStartupChecks();
		expect(logger.warn).toHaveBeenCalledExactlyOnceWith('"PUBLIC_URL" should be a full URL');
	});
});

test('the version line names Backoffice and Directus 11.17.4', () => {
	expect(VERSION_LOG_LINE).toMatch(/^Backoffice \d+\.\d+\.\d+$/);
});
