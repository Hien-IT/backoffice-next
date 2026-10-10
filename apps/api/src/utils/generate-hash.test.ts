import { useEnv } from '@backoffice/env';
import argon2 from 'argon2';
import { describe, expect, test, vi } from 'vitest';
import { generateHash } from './generate-hash.js';

vi.mock('@backoffice/env');

describe('generateHash', () => {
	test('hashes with the argon2 defaults Directus uses', async () => {
		vi.mocked(useEnv).mockReturnValue({});
		const hash = await generateHash('password');
		expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=4\$/);
		expect(await argon2.verify(hash, 'password')).toBe(true);
	});

	test('reads the HASH_ options and ignores HASH_RAW', async () => {
		vi.mocked(useEnv).mockReturnValue({ HASH_TIME_COST: 2, HASH_MEMORY_COST: 4096, HASH_RAW: true });
		const hash = await generateHash('password');
		expect(hash).toMatch(/^\$argon2id\$v=19\$m=4096,t=2,p=4\$/);
	});

	test('passes HASH_ASSOCIATED_DATA as a buffer', async () => {
		vi.mocked(useEnv).mockReturnValue({ HASH_ASSOCIATED_DATA: 'data' });
		const hash = await generateHash('password');
		expect(hash).toContain(',data=');
	});
});
