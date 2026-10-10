import { useEnv } from '@backoffice/env';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useLogger } from './logger/index.js';

vi.mock('@backoffice/env');
vi.mock('./logger/index.js');
vi.mock('./database/index.js', () => ({ default: vi.fn() }));

const logger = { warn: vi.fn(), error: vi.fn() };

async function load(env: Record<string, unknown>) {
	vi.resetModules();
	vi.mocked(useEnv).mockReturnValue(env);
	vi.mocked(useLogger).mockReturnValue(logger as never);
	const auth = await import('./auth.js');
	await auth.registerAuthProviders();
	return auth;
}

beforeEach(() => {
	vi.spyOn(process, 'exit').mockImplementation((() => {
		throw new Error('exit');
	}) as never);
});

afterEach(() => vi.clearAllMocks());

describe('registerAuthProviders', () => {
	test('registers the default provider, unless AUTH_DISABLE_DEFAULT', async () => {
		expect((await load({})).getAuthProvider('default').constructor.name).toBe('LocalAuthDriver');

		const disabled = await load({ AUTH_DISABLE_DEFAULT: true });
		expect(() => disabled.getAuthProvider('default')).toThrow();
		expect(logger.error).toHaveBeenCalledWith('Auth provider not configured');
	});

	test('registers named local providers', async () => {
		const auth = await load({ AUTH_PROVIDERS: 'staff', AUTH_STAFF_DRIVER: 'local' });
		expect(auth.getAuthProvider('staff').constructor.name).toBe('LocalAuthDriver');
	});

	test('warns about a missing driver and an unknown driver, like Directus', async () => {
		await load({ AUTH_PROVIDERS: 'a,b', AUTH_B_DRIVER: 'kerberos' });
		expect(logger.warn).toHaveBeenCalledWith('Missing driver definition for "a" auth provider.');
		expect(logger.warn).toHaveBeenCalledWith('Invalid "kerberos" auth driver.');
	});

	test('ignores saml providers with one warning each; their users get INVALID_PROVIDER_CONFIG (FR-078)', async () => {
		const auth = await load({ AUTH_PROVIDERS: 'saml', AUTH_SAML_DRIVER: 'saml' });

		expect(logger.warn).toHaveBeenCalledTimes(1);
		expect(logger.warn).toHaveBeenCalledWith(
			'Auth provider "saml" uses the "saml" driver, which is not supported by Backoffice; the provider is ignored.',
		);

		expect(() => auth.getAuthProvider('saml')).toThrow(expect.objectContaining({ code: 'INVALID_PROVIDER_CONFIG' }));
	});

	test('exits when a provider is named "default"', async () => {
		await expect(load({ AUTH_PROVIDERS: 'default', AUTH_DEFAULT_DRIVER: 'local' })).rejects.toThrow('exit');
		expect(logger.error).toHaveBeenCalledWith('Cannot override "default" auth provider.');
	});
});
