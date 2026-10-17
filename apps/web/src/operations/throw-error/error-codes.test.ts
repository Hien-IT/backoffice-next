import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ErrorCode } from './error-codes.ts';

// Spec 017 FR-041, CHK050: the copied list matches the workspace lib the API uses (itself a port of @directus/errors).
describe('ErrorCode', () => {
	it('has the codes of libs/errors/src/codes.ts', () => {
		const source = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), '../../../../../libs/errors/src/codes.ts'),
			'utf8',
		);
		const codes = [...source.matchAll(/=\s*'([A-Z_]+)'/g)].map((match) => match[1]);

		expect(codes.length).toBeGreaterThan(30);
		expect(Object.values(ErrorCode)).toEqual(codes);
	});
});
