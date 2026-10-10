import { useEnv } from '@backoffice/env';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { _cache, getSecret } from './get-secret.js';

vi.mock('@backoffice/env');

afterEach(() => {
	_cache.secret = null;
});

describe('getSecret', () => {
	test('returns SECRET when it is set', () => {
		vi.mocked(useEnv).mockReturnValue({ SECRET: 'shared-secret' });
		expect(getSecret()).toBe('shared-secret');
	});

	test('generates one random secret per process when SECRET is missing', () => {
		vi.mocked(useEnv).mockReturnValue({});
		const first = getSecret();
		expect(first).toMatch(/^[\w-]{32}$/);
		expect(getSecret()).toBe(first);
	});
});
