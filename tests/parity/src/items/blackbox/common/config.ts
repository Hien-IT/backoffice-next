// Ported from directus/tests/blackbox/common/config.ts (getUrl and the env values the item tests read).
// Backoffice: the suite runs once per app of the `blackbox` profile pair (PARITY_BLACKBOX_APP, research R6 of spec 005):
// getUrl() is the app under test; getSetupUrl() is the Directus of the pair, which makes the data model (/collections,
// /fields, /relations are feature 006), the roles, policies and users, and answers GraphQL (feature 011).
import { readFileSync } from 'node:fs';
import { allVendors, type Vendor } from './get-dbs-to-test';

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
};

function url(key: string): string {
	const value = process.env[key];
	if (!value) throw new Error(`${key} must be set: start the parity environment with the blackbox profile`);
	return value;
}

export function getUrl(_vendor: Vendor, _overrideEnv?: Env): string {
	return process.env['PARITY_BLACKBOX_APP'] === 'directus'
		? url('DIRECTUS_URL_BLACKBOX')
		: url('BACKOFFICE_URL_BLACKBOX');
}

export function getSetupUrl(_vendor?: Vendor, _overrideEnv?: Env): string {
	return url('DIRECTUS_URL_BLACKBOX');
}

export default config;
