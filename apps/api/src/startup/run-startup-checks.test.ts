import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { warnSingleInstance } from '../config/warn-single-instance.js';
import { warnUnsupportedVariables } from '../config/warn-unsupported-variables.js';
import { validateDatabaseConnection } from '../database/index.js';
import { useLogger } from '../logger/index.js';
import { VERSION_LOG_LINE } from '../version.js';
import { runStartupChecks } from './run-startup-checks.js';

vi.mock('@backoffice/env');
vi.mock('../config/warn-single-instance.js');
vi.mock('../config/warn-unsupported-variables.js');
vi.mock('../database/index.js');
vi.mock('../logger/index.js');
// Loading these modules validates the rate limiter configuration (row 6).
vi.mock('../middleware/rate-limiter-global.js', () => (order.push('rate-limiter-global'), { default: vi.fn() }));
vi.mock('../middleware/rate-limiter-ip.js', () => (order.push('rate-limiter-ip'), { default: vi.fn() }));

const order: string[] = vi.hoisted(() => []);
const logger = { info: vi.fn((m: string) => order.push(`info ${m}`)) };

beforeEach(() => {
	order.length = 0;
	vi.mocked(useLogger).mockReturnValue(logger as any);
	vi.mocked(useEnv).mockImplementation(() => (order.push('env'), {}));
	vi.mocked(warnUnsupportedVariables).mockImplementation(() => void order.push('unsupported'));
	vi.mocked(warnSingleInstance).mockImplementation(() => void order.push('single-instance'));
	vi.mocked(validateDatabaseConnection).mockImplementation(async () => void order.push('db'));
});

test('runs the steps in the order of contracts/startup.md', async () => {
	await runStartupChecks();
	expect(order).toEqual([
		'env',
		`info ${VERSION_LOG_LINE}`,
		'unsupported',
		'single-instance',
		'rate-limiter-global',
		'rate-limiter-ip',
		'db',
	]);
});

test('a configuration error stops before anything else', async () => {
	vi.mocked(useEnv).mockImplementation(() => {
		throw new SyntaxError('Invalid regular expression: /(/: Unterminated group');
	});

	await expect(runStartupChecks()).rejects.toThrow(SyntaxError);
	expect(order).toEqual([]);
});

test('the version line names Backoffice and Directus 11.17.4', () => {
	expect(VERSION_LOG_LINE).toMatch(/^Backoffice \d+\.\d+\.\d+ \(compatible with Directus 11\.17\.4\)$/);
});
