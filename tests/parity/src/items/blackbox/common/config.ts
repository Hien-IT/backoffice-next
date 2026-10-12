// Ported from directus/tests/blackbox/common/config.ts (getUrl and the env values the item tests read).
// Backoffice: the suite runs once per app of the `blackbox` profile pair (PARITY_BLACKBOX_APP, research R6 of spec 005):
// getUrl() is the app under test; getSetupUrl() makes the data model, the roles, policies and users: the Directus of the
// pair, or the new app with PARITY_BLACKBOX_SETUP_APP=backoffice (feature 006, FR-064). GraphQL stays on Directus (011).
// Feature 006 (research R7): the files that start their own Directus nodes get the profile pairs instead: an env with
// URL (schema-cache.test.ts, through nodeUrl) or with TZ (the two timezone files) names the node; TEST_NO_CACHE (the
// node with CACHE_SCHEMA=false) is not used, both apps clear their schema through the bus after every change.
// Feature 007 (T048): the `local` and `minio` storages of the files and assets files are `local` and `s3` here
// (getStorages, PARITY_STORAGES); the two nodes cache-revalidate.test.ts spawns are the assets-limit (revalidate) and
// assets-stress (ASSETS_CACHE_TTL=1h) pairs; paths.cwd holds the `assets` directory of the image fixtures.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { knexConfig } from '../../../config.js';

export { getStorages } from '../../../config.js';

export const paths = { cwd: fileURLToPath(new URL('../../../../fixtures', import.meta.url)) };
import { allVendors, type Vendor } from './get-dbs-to-test.js';

export type Env = Record<Vendor, Record<string, string>>;

/** The values of env/profile-blackbox.env, the same as the env of directus/tests/blackbox for these keys. */
const profileEnv: Record<string, string> = Object.fromEntries(
	readFileSync(new URL('../../../../env/profile-blackbox.env', import.meta.url), 'utf8')
		.split('\n')
		.filter((line) => /^[A-Z_]+=/.test(line))
		.map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
);

const config = {
	envs: Object.fromEntries(allVendors.map((vendor) => [vendor, { ...profileEnv }])) as Env,
	// The databases of the parity environment, seen from the host (feature 006: schema-cache and timezone files).
	knexConfig,
};

function url(key: string): string {
	const value = process.env[key];
	if (!value) throw new Error(`${key} must be set: start the parity environment with the blackbox profile`);
	return value;
}

type App = 'directus' | 'backoffice';

const appUnderTest = (): App => (process.env['PARITY_BLACKBOX_APP'] === 'directus' ? 'directus' : 'backoffice');

const pairUrl = (app: App, profile: string) =>
	url(`${app === 'directus' ? 'DIRECTUS' : 'BACKOFFICE'}_URL_${profile.toUpperCase().replace(/-/g, '_')}`);

/** The node of a profile pair: 1 is the app under test, 2 the other app of the pair (schema-cache.test.ts). */
export function nodeUrl(
	profile: 'schema-cache' | 'schema-cache-nomsg' | 'assets-limit' | 'assets-stress',
	node: 1 | 2,
): string {
	const app = appUnderTest();
	return pairUrl(node === 1 ? app : app === 'directus' ? 'backoffice' : 'directus', profile);
}

/** Whether the URLs of a profile pair are set (the pair runs in the parity-blackbox job only). */
export function hasProfile(profile: string): boolean {
	return Boolean(process.env[`DIRECTUS_URL_${profile.toUpperCase().replace(/-/g, '_')}`]);
}

const TZ_PROFILES: Record<string, string> = { 'Asia/Seoul': 'tz-asia', 'America/Sao_Paulo': 'tz-america' };

function overridden(vendor: Vendor, overrideEnv?: Env): string | undefined {
	const env = overrideEnv?.[vendor];
	if (env?.['URL']) return env['URL'];

	if (env?.['TZ']) {
		const profile = TZ_PROFILES[env['TZ']];

		if (!profile) {
			throw new Error(
				`No parity profile for TZ=${env['TZ']}: only ${Object.keys(TZ_PROFILES).join(' and ')} (CI runs in UTC)`,
			);
		}

		return pairUrl(appUnderTest(), profile);
	}

	return undefined;
}

export function getUrl(vendor: Vendor, overrideEnv?: Env): string {
	return overridden(vendor, overrideEnv) ?? pairUrl(appUnderTest(), 'blackbox');
}

/** The Directus of the blackbox pair, for the routes the new app does not serve yet (/utils is feature 010). */
export function getDirectusUrl(): string {
	return pairUrl('directus', 'blackbox');
}

export function getSetupUrl(vendor?: Vendor, overrideEnv?: Env): string {
	const node = vendor ? overridden(vendor, overrideEnv) : undefined;
	if (node) return node;
	return pairUrl(process.env['PARITY_BLACKBOX_SETUP_APP'] === 'backoffice' ? 'backoffice' : 'directus', 'blackbox');
}

export default config;
