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

test('one line, A–Z, names only: EMAIL_TRANSPORT (C) yes, ADMIN_EMAIL (A since 010), PROJECT_OWNER (A since 021) and ACCEPT_TERMS (not a listed Directus variable) no, FOO (not Directus) no', () => {
	warnUnsupportedVariables({
		PORT: '1',
		EMAIL_TRANSPORT: 'secret-looking-value',
		ADMIN_EMAIL: 'a@b.c',
		PROJECT_OWNER: 'a@b.c',
		ACCEPT_TERMS: 'true',
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

test('flows variables are supported since feature 009, other email rate limiters stay group C', () => {
	expect(
		getUnsupportedVariables({
			FLOWS_ENV_ALLOW_LIST: 'A,B',
			FLOWS_RUN_SCRIPT_MAX_MEMORY: '32',
			FLOWS_RUN_SCRIPT_TIMEOUT: '10000',
			RATE_LIMITER_EMAIL_FLOWS_ENABLED: 'true',
			RATE_LIMITER_EMAIL_ENABLED: 'true',
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

// Feature 007: the files section of tests/parity/env/postgres.env warns about nothing.
test('feature 007: storage, files, assets and TUS settings of the parity env are not reported', () => {
	expect(
		getUnsupportedVariables({
			STORAGE_LOCATIONS: 'local,s3',
			STORAGE_LOCAL_DRIVER: 'local',
			STORAGE_S3_FORCE_PATH_STYLE: 'true',
			FILES_MAX_UPLOAD_SIZE: '30mb',
			FILES_MIME_TYPE_ALLOW_LIST: 'image/*',
			ASSETS_CACHE_REVALIDATE: 'true',
			TUS_ENABLED: 'true',
			SYNCHRONIZATION_STORE: 'redis',
			// Feature 010: read since /utils/import (group A).
			IMPORT_TIMEOUT: '1h',
			EMAIL_TRANSPORT: 'smtp',
		}),
	).toEqual(['EMAIL_TRANSPORT']);
});

// Feature 008 (spec FR-052): the retention settings are read by schedules/retention.ts and never reported; the email
// settings stay unsupported until feature 010.
test('feature 008: retention settings are not reported, email settings still are', () => {
	expect(
		getUnsupportedVariables({
			RETENTION_ENABLED: 'true',
			RETENTION_BATCH: '3',
			RETENTION_SCHEDULE: '*/10 * * * * *',
			ACTIVITY_RETENTION: '2s',
			REVISIONS_RETENTION: '1s',
			FLOW_LOGS_RETENTION: '2s',
			EMAIL_TRANSPORT: 'smtp',
		}),
	).toEqual(['EMAIL_TRANSPORT']);
});
