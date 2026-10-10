// Ported from directus/api/src/auth.ts
import { useEnv } from '@backoffice/env';
import { InvalidProviderConfigError } from '@backoffice/errors';
import { toArray } from '@backoffice/utils';
import type { AuthDriver } from './auth/auth.js';
import { LocalAuthDriver } from './auth/drivers/index.js';
import { DEFAULT_AUTH_PROVIDER } from './constants.js';
import getDatabase from './database/index.js';
import { useLogger } from './logger/index.js';
import type { AuthDriverOptions } from './types/index.js';
import { getConfigFromEnv } from './utils/get-config-from-env.js';

const providers: Map<string, AuthDriver> = new Map();

export function getAuthProvider(provider: string): AuthDriver {
	const logger = useLogger();

	if (!providers.has(provider)) {
		logger.error('Auth provider not configured');
		throw new InvalidProviderConfigError({ provider });
	}

	return providers.get(provider)!;
}

export async function registerAuthProviders(): Promise<void> {
	const env = useEnv();
	const logger = useLogger();
	const options = { knex: getDatabase() };

	const providerNames = toArray(env['AUTH_PROVIDERS'] as string);

	// Register default provider if not disabled
	if (!env['AUTH_DISABLE_DEFAULT']) {
		const defaultProvider = getProviderInstance('local', options)!;
		providers.set(DEFAULT_AUTH_PROVIDER, defaultProvider);
	}

	if (!env['AUTH_PROVIDERS']) {
		return;
	}

	// Register configured providers
	providerNames.forEach((name: string) => {
		name = name.trim();

		if (name === DEFAULT_AUTH_PROVIDER) {
			logger.error(`Cannot override "${DEFAULT_AUTH_PROVIDER}" auth provider.`);
			process.exit(1);
		}

		const { driver, ...config } = getConfigFromEnv(`AUTH_${name.toUpperCase()}_`);

		if (!driver) {
			logger.warn(`Missing driver definition for "${name}" auth provider.`);
			return;
		}

		// Backoffice: SAML is out of scope (Principle XI); like Directus without the provider, refresh and logout of
		// its users answer INVALID_PROVIDER_CONFIG (FR-078 of spec 003).
		if (driver === 'saml') {
			logger.warn(
				`Auth provider "${name}" uses the "saml" driver, which is not supported by Backoffice; the provider is ignored.`,
			);
			return;
		}

		const provider = getProviderInstance(driver, options, { provider: name, ...config });

		if (!provider) {
			logger.warn(`Invalid "${driver}" auth driver.`);
			return;
		}

		providers.set(name, provider);
	});
}

function getProviderInstance(
	driver: string,
	options: AuthDriverOptions,
	config: Record<string, any> = {},
): AuthDriver | undefined {
	switch (driver) {
		case 'local':
			return new LocalAuthDriver(options, config);

		// ponytail: openid, oauth2 and ldap are registered with Phase 9 of feature 003 (T059-T062).
	}

	return undefined;
}
