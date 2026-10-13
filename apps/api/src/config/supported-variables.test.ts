import { readFileSync } from 'node:fs';
import { DIRECTUS_VARIABLES, isDirectusVariable } from '@backoffice/env';
import { describe, expect, test } from 'vitest';
import { NOT_APPLICABLE_VARIABLES, SUPPORTED_VARIABLES, isNotApplicable, isSupported } from './supported-variables.js';

const contract = readFileSync(
	new URL('../../../../specs/001-platform-foundation/contracts/config.md', import.meta.url),
	'utf8',
);

/** Backticked names of a row of the §5 table ("| **A. Hỗ trợ** | ..."). */
function contractGroup(label: string): string[] {
	const row = contract.split('\n').find((line) => line.startsWith(`| **${label}`));
	if (!row) throw new Error(`row ${label} not found`);
	const names = row.split('|')[3]!;
	return [...names.matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
}

const sample = (source: string) =>
	source
		.replace(/^\^|\$$/g, '')
		.replace(/\(\?![^)]*\)/g, '')
		.replace(/\.\+/g, 'X');

describe('groups match contracts/config.md §5', () => {
	test('group A', () => {
		const sources = SUPPORTED_VARIABLES.map((r) => sample(r.source));
		const contractNames = contractGroup('A. Hỗ trợ').map(sample);
		expect(sources.sort()).toEqual(
			contractNames
				.filter(
					(n) =>
						!n.startsWith('RATE_LIMITER_REGISTRATION') &&
						(!n.startsWith('RATE_LIMITER_EMAIL') || n.startsWith('RATE_LIMITER_EMAIL_FLOWS')),
				)
				.sort(),
		);
	});

	test('group B', () => {
		expect(NOT_APPLICABLE_VARIABLES.map((r) => sample(r.source)).sort()).toEqual(
			contractGroup('B. Không áp dụng').sort(),
		);
	});
});

test('every group A and B pattern is a Directus variable', () => {
	for (const regex of [...SUPPORTED_VARIABLES, ...NOT_APPLICABLE_VARIABLES]) {
		expect(isDirectusVariable(sample(regex.source)), regex.source).toBe(true);
	}

	expect(DIRECTUS_VARIABLES.length).toBeGreaterThan(100);
});

test.each([
	['PORT', true],
	['DB_CLIENT', true],
	['STORAGE_S3_DRIVER', true],
	['RATE_LIMITER_POINTS', true],
	['RATE_LIMITER_GLOBAL_ENABLED', true],
	['RATE_LIMITER_REGISTRATION_ENABLED', true],
	['RATE_LIMITER_EMAIL_FLOWS_POINTS', true],
	['RATE_LIMITER_EMAIL_FLOWS_ERROR_MESSAGE', true],
	['RATE_LIMITER_EMAIL_ENABLED', false],
	['FLOWS_ENV_ALLOW_LIST', true],
	['FLOWS_RUN_SCRIPT_MAX_MEMORY', true],
	['FLOWS_RUN_SCRIPT_TIMEOUT', true],
	['AUTH_PROVIDERS', true],
	['SERVE_APP', false],
])('isSupported(%s) = %s', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});

test('isNotApplicable', () => {
	expect(isNotApplicable('ADMIN_EMAIL')).toBe(true);
	expect(isNotApplicable('PORT')).toBe(false);
});

// Feature 002 (specs/002 contracts/config.md): schema, system, lock and permissions cache variables are supported.
test.each([
	'CACHE_SCHEMA',
	'CACHE_SCHEMA_MAX_ITERATIONS',
	'CACHE_SCHEMA_SYNC_TIMEOUT',
	'CACHE_SCHEMA_FREEZE_ENABLED',
	'CACHE_SYSTEM_TTL',
	'CACHE_DEPLOYMENT_TTL',
	'CACHE_AUTO_PURGE',
	'REDIS_BUS_NAMESPACE',
	'REDIS_LOCK_NAMESPACE',
	'REDIS_PERMISSIONS_NAMESPACE',
])('%s is supported', (name) => {
	expect(isSupported(name)).toBe(true);
});

// Feature 005 (specs/005 contracts/config.md): the response cache variables and the three variables that decide whether
// the websocket.event bus bridge is registered; the other WebSocket variables stay unsupported (Principle XI).
test.each([
	['CACHE_CONTROL_S_MAXAGE', true],
	['CACHE_STATUS_HEADER', true],
	['CACHE_VALUE_MAX_SIZE', true],
	['CACHE_SKIP_ALLOWED', true],
	['WEBSOCKETS_ENABLED', true],
	['WEBSOCKETS_REST_ENABLED', true],
	['WEBSOCKETS_GRAPHQL_ENABLED', true],
	['WEBSOCKETS_REST_AUTH', false],
	['WEBSOCKETS_HEARTBEAT_ENABLED', false],
	['EXPORT_BATCH_SIZE', false],
])('isSupported(%s) = %s (feature 005)', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});

// Feature 003 (specs/003 contracts/config.md): auth variables are supported, except the saml-only ones and email.
test.each([
	['ACCESS_TOKEN_TTL', true],
	['SESSION_REFRESH_GRACE_PERIOD', true],
	['HASH_MEMORY_COST', true],
	['MAX_BATCH_MUTATION', true],
	['CACHE_AUTO_PURGE_IGNORE_LIST', true],
	['AUTH_KEYCLOAK_ISSUER_URL', true],
	['AUTH_KEYCLOAK_CLIENT_HTTP_TIMEOUT', true],
	['AUTH_LDAP_BIND_DN', true],
	['AUTH_SAML_IDP_METADATA', false],
	['AUTH_SAML_SP_METADATA', false],
	['EMAIL_TRANSPORT', false],
])('feature 003: isSupported(%s) = %s', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});

// Feature 004 (specs/004 contracts/config.md): invites, registration and the query engine; email stays unsupported.
test.each([
	['USER_INVITE_TOKEN_TTL', true],
	['USER_INVITE_URL_ALLOW_LIST', true],
	['USER_REGISTER_URL_ALLOW_LIST', true],
	['REGISTER_STALL_TIME', true],
	['EMAIL_VERIFICATION_TOKEN_TTL', true],
	['RATE_LIMITER_REGISTRATION_POINTS', true],
	['QUERY_LIMIT_DEFAULT', true],
	['QUERY_LIMIT_MAX', true],
	['RELATIONAL_BATCH_SIZE', true],
	['MAX_JSON_QUERY_DEPTH', true],
	['RATE_LIMITER_EMAIL_ENABLED', false],
	['EMAIL_FROM', false],
])('feature 004: isSupported(%s) = %s', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});

// Feature 007 (spec FR-072): the file variables are read now; import of items and the drivers out of scope are not.
test.each([
	['ASSETS_CACHE_TTL', true],
	['ASSETS_TRANSFORM_MAX_CONCURRENT', true],
	['FILES_MAX_UPLOAD_SIZE', true],
	['FILE_METADATA_ALLOW_LIST', true],
	['IMPORT_IP_DENY_LIST', true],
	['SYNCHRONIZATION_STORE', true],
	['IMPORT_TIMEOUT', false],
	['IMPORT_MAX_CONCURRENCY', false],
	['STORAGE_GCS_KEY_FILENAME', false],
	['STORAGE_AZURE_CONTAINER_NAME', false],
])('feature 007: isSupported(%s) is %s', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});
