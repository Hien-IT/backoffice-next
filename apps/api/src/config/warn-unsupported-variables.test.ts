import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useLogger } from '../logger/index.js';
import {
	SERVE_APP_MESSAGE,
	UNSUPPORTED_MESSAGE,
	getRawConfiguration,
	getUnsupportedVariables,
	warnUnsupportedVariables,
} from './warn-unsupported-variables.js';

vi.mock('../logger/index.js');

const logger = { warn: vi.fn() };

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useLogger).mockReturnValue(logger as any);
});

afterEach(() => vi.unstubAllEnvs());

test('one line, A–Z, names only: EMAIL_TRANSPORT (C) yes, ADMIN_EMAIL (B) no, FOO (not Directus) no', () => {
	warnUnsupportedVariables({
		PORT: '1',
		EMAIL_TRANSPORT: 'secret-looking-value',
		ADMIN_EMAIL: 'a@b.c',
		FOO: 'x',
		EMAIL_FROM: 'x',
	});
	expect(logger.warn).toHaveBeenCalledOnce();
	expect(logger.warn).toHaveBeenCalledWith(`${UNSUPPORTED_MESSAGE}EMAIL_FROM, EMAIL_TRANSPORT`);
	expect(logger.warn.mock.calls[0]![0]).not.toContain('secret-looking-value');
});

test('X_FILE counts as X, each name once; defaults are not counted', () => {
	expect(getUnsupportedVariables({ EMAIL_TRANSPORT: 'a', EMAIL_TRANSPORT_FILE: '/f', PORT_FILE: '/p' })).toEqual([
		'EMAIL_TRANSPORT',
	]);
	expect(getUnsupportedVariables({})).toEqual([]);
});

test('email rate limiters are group C; the registration limiter is supported since feature 004', () => {
	expect(
		getUnsupportedVariables({
			RATE_LIMITER_REGISTRATION_ENABLED: 'true',
			RATE_LIMITER_EMAIL_ENABLED: 'true',
			RATE_LIMITER_POINTS: '5',
		}),
	).toEqual(['RATE_LIMITER_EMAIL_ENABLED']);
});

test('no warning without unsupported variables', () => {
	warnUnsupportedVariables({ PORT: '1' });
	expect(logger.warn).not.toHaveBeenCalled();
});

test.each([
	['true', true],
	['boolean:true', true],
	['false', false],
	[undefined, false],
])('SERVE_APP=%s warns separately: %s', (value, warns) => {
	warnUnsupportedVariables(value === undefined ? {} : { SERVE_APP: value });
	expect(logger.warn.mock.calls.some(([m]) => m === SERVE_APP_MESSAGE)).toBe(warns);
	expect(logger.warn.mock.calls.some(([m]) => String(m).includes('SERVE_APP') && m !== SERVE_APP_MESSAGE)).toBe(false);
});

test('raw configuration = process env + CONFIG_PATH file', () => {
	const dir = mkdtempSync(join(tmpdir(), 'raw-'));
	writeFileSync(join(dir, 'c.env'), 'EMAIL_TRANSPORT=a\n');
	vi.stubEnv('CONFIG_PATH', join(dir, 'c.env'));
	vi.stubEnv('EMAIL_FROM', 'x');
	const raw = getRawConfiguration();
	expect(raw['EMAIL_TRANSPORT']).toBe('a');
	expect(raw['EMAIL_FROM']).toBe('x');

	vi.stubEnv('CONFIG_PATH', join(dir, 'missing.env'));
	expect(getRawConfiguration()['EMAIL_TRANSPORT']).toBeUndefined();
});

test('defaults to the real raw configuration', () => {
	vi.stubEnv('CONFIG_PATH', '/nonexistent/.env');
	vi.stubEnv('TELEMETRY', 'false');
	warnUnsupportedVariables();
	expect(logger.warn.mock.calls[0]?.[0]).toContain('TELEMETRY');
});
