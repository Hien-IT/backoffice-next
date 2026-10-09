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
				.filter((n) => !n.startsWith('RATE_LIMITER_REGISTRATION') && !n.startsWith('RATE_LIMITER_EMAIL'))
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
	['RATE_LIMITER_REGISTRATION_ENABLED', false],
	['RATE_LIMITER_EMAIL_FLOWS_POINTS', false],
	['AUTH_PROVIDERS', false],
	['SERVE_APP', false],
])('isSupported(%s) = %s', (name, expected) => {
	expect(isSupported(name)).toBe(expected);
});

test('isNotApplicable', () => {
	expect(isNotApplicable('ADMIN_EMAIL')).toBe(true);
	expect(isNotApplicable('PORT')).toBe(false);
});
