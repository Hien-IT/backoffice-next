// Feature 003, contracts/startup-logs.md §1 (steps 16b, 16c): the built API on the host with each provider
// configuration that Directus logs or refuses at startup. Startup only reads the database.
import getPort from 'get-port';
import { afterEach, describe, expect, test } from 'vitest';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { parseSuite } from '../suite.js';
import { hostDbEnv, type RunningApi, runApi, stopApi, waitForPing } from './run-api.js';

const [vendor] = getDbsToTest();
const running: RunningApi[] = [];

afterEach(async () => {
	await Promise.all(running.splice(0).map(stopApi));
});

async function start(env: Record<string, string>) {
	const port = await getPort();
	const api = runApi({ ...hostDbEnv(vendor!), SECRET: 'parity-startup', PORT: String(port), ...env });
	running.push(api);
	return { api, port };
}

/** pino level of the first raw log line whose message contains `text` (40 warn, 50 error). */
function levelOf(api: RunningApi, text: string): number | undefined {
	for (const line of api.output().split('\n')) {
		try {
			const entry = JSON.parse(line);
			if (String(entry.msg).includes(text)) return entry.level;
		} catch {
			// not JSON
		}
	}

	return undefined;
}

const oidc = (name: string, extra: Record<string, string> = {}) => ({
	AUTH_PROVIDERS: name,
	[`AUTH_${name.toUpperCase()}_DRIVER`]: 'openid',
	[`AUTH_${name.toUpperCase()}_CLIENT_ID`]: 'client',
	[`AUTH_${name.toUpperCase()}_CLIENT_SECRET`]: 'secret',
	// Nothing listens there: discovery fails at once.
	[`AUTH_${name.toUpperCase()}_ISSUER_URL`]: 'http://127.0.0.1:9/',
	...extra,
});

describe.runIf(parseSuite() === 'full' && (vendor === 'postgres' || vendor === 'sqlite3'))(
	'auth providers at startup (contracts/startup-logs.md §1)',
	() => {
		test('a provider named default: error, exit 1', async () => {
			const { api } = await start({ AUTH_PROVIDERS: 'default' });
			expect((await api.exited).code).toBe(1);
			expect(levelOf(api, 'Cannot override "default" auth provider.')).toBe(50);
		});

		test.each([
			['missing driver', { AUTH_PROVIDERS: 'nodriver' }, 'Missing driver definition for "nodriver" auth provider.'],
			['unknown driver', { AUTH_PROVIDERS: 'kerb', AUTH_KERB_DRIVER: 'kerberos' }, 'Invalid "kerberos" auth driver.'],
			[
				'saml driver',
				{ AUTH_PROVIDERS: 'corp', AUTH_CORP_DRIVER: 'saml' },
				'Auth provider "corp" uses the "saml" driver, which is not supported by Backoffice; the provider is ignored.',
			],
		])('%s: warn, the API starts', async (_name, env, message) => {
			const { api, port } = await start(env);
			expect(await waitForPing(api, port), api.output()).toBe(true);
			expect(levelOf(api, message)).toBe(40);
		});

		test('OpenID without its required variables: error, exit 1', async () => {
			const { api } = await start({ AUTH_PROVIDERS: 'sso', AUTH_SSO_DRIVER: 'openid' });
			expect((await api.exited).code).toBe(1);
			expect(levelOf(api, 'Invalid provider config')).toBe(50);
		});

		test.each([
			['openid', '[OpenID]'],
			['oauth2', '[OAuth2]'],
		])('%s ROLE_MAPPING given as an array: error, exit 1', async (driver, prefix) => {
			const { api } = await start({
				...oidc('mapped', { AUTH_MAPPED_ISSUER_DISCOVERY_MUST_SUCCEED: 'false' }),
				AUTH_MAPPED_DRIVER: driver,
				AUTH_MAPPED_AUTHORIZE_URL: 'http://127.0.0.1:9/authorize',
				AUTH_MAPPED_ACCESS_URL: 'http://127.0.0.1:9/token',
				AUTH_MAPPED_PROFILE_URL: 'http://127.0.0.1:9/userinfo',
				AUTH_MAPPED_ROLE_MAPPING: 'json:["parity-admins"]',
			});

			expect((await api.exited).code).toBe(1);
			expect(levelOf(api, `${prefix} Expected a JSON-Object as role mapping, got an Array instead.`)).toBe(50);
		});

		test('IdP not reachable: error, then exit 1 while ISSUER_DISCOVERY_MUST_SUCCEED is not false', async () => {
			const { api } = await start(oidc('down'));
			expect((await api.exited).code).toBe(1);
			expect(levelOf(api, '[OpenID] Failed to fetch provider config')).toBe(50);
			expect(levelOf(api, 'AUTH_DOWN_ISSUER_DISCOVERY_MUST_SUCCEED is enabled and discovery failed, exiting')).toBe(50);
		});

		test('IdP not reachable with ISSUER_DISCOVERY_MUST_SUCCEED=false: error, the API keeps running', async () => {
			const { api, port } = await start(oidc('down', { AUTH_DOWN_ISSUER_DISCOVERY_MUST_SUCCEED: 'false' }));
			expect(await waitForPing(api, port), api.output()).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect(levelOf(api, '[OpenID] Failed to fetch provider config')).toBe(50);
			expect(api.child.exitCode).toBeNull();
		});
	},
);
