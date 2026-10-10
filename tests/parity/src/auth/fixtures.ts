// Feature 003 (FR-103, research R11): users, roles, policies and settings for the auth parity tests, created
// through the Directus API because /users, /roles and /policies come to the new app with feature 004. Each app
// gets its own copy of a fixture (same attributes, other email and id), so stateful flows never share a token.
import { randomBytes } from 'node:crypto';
import { directusRequest } from '../directus-api.js';

export type App = 'directus' | 'backoffice';
export const APPS: App[] = ['directus', 'backoffice'];

export interface Urls {
	directus: string;
	backoffice: string;
}

/** URLs of the main pair, or of a profile pair when given (from global-setup). */
export function urls(profile?: string): Urls {
	const suffix = profile ? `_${profile.toUpperCase().replace(/-/g, '_')}` : '';
	const directus = process.env[`DIRECTUS_URL${suffix}`];
	const backoffice = process.env[`BACKOFFICE_URL${suffix}`];
	if (!directus || !backoffice) throw new Error(`DIRECTUS_URL${suffix} and BACKOFFICE_URL${suffix} must be set`);
	return { directus, backoffice };
}

export const PASSWORD = 'parity-password-1';

export const uniqueEmail = (prefix: string) => `${prefix}-${randomBytes(4).toString('hex')}@example.com`;

const created: { users: string[]; roles: string[]; policies: string[] } = { users: [], roles: [], policies: [] };

export interface PolicyOptions {
	admin?: boolean;
	app?: boolean;
	enforceTfa?: boolean;
	ipAccess?: string[] | null;
}

/** A role with one policy attached through directus_access. Returns the role id. */
export async function createRole(name: string, options: PolicyOptions = {}, id?: string): Promise<string> {
	const policy = await directusRequest('POST', '/policies', {
		name: `${name} policy`,
		icon: 'badge',
		admin_access: options.admin ?? false,
		app_access: options.app ?? false,
		enforce_tfa: options.enforceTfa ?? false,
		ip_access: options.ipAccess ?? null,
	});

	const role = await directusRequest('POST', '/roles', { ...(id ? { id } : {}), name, icon: 'person' });
	await directusRequest('POST', '/access', { role: role.data.id, policy: policy.data.id });

	created.policies.push(policy.data.id);
	created.roles.push(role.data.id);
	return role.data.id;
}

/** Creates the role with this id when it does not exist yet (fixed ids referenced by env/profile-sso.env). */
export async function ensureRole(id: string, name: string, options: PolicyOptions = {}): Promise<string> {
	const existing = await directusRequest('GET', `/roles?filter[id][_eq]=${id}&fields=id`);
	if (existing.data.length > 0) return id;
	return createRole(name, options, id);
}

export interface UserOptions {
	email?: string;
	password?: string | null;
	status?: 'active' | 'invited' | 'draft' | 'suspended' | 'archived';
	role?: string | null;
	provider?: string;
	external_identifier?: string;
	token?: string;
	tfa_secret?: string;
	first_name?: string;
	last_name?: string;
}

export interface User {
	id: string;
	email: string;
	password: string | null;
}

export async function createUser(prefix: string, options: UserOptions = {}): Promise<User> {
	const email = options.email ?? uniqueEmail(prefix);
	const password = options.password === undefined ? PASSWORD : options.password;
	const { password: _p, email: _e, ...rest } = options;

	const user = await directusRequest('POST', '/users', {
		email,
		...(password !== null ? { password } : {}),
		status: 'active',
		...rest,
	});

	created.users.push(user.data.id);
	return { id: user.data.id, email, password };
}

/** One user per app with the same attributes (research R11). */
export async function createUserPerApp(prefix: string, options: UserOptions = {}): Promise<Record<App, User>> {
	return {
		directus: await createUser(`${prefix}-d`, options),
		backoffice: await createUser(`${prefix}-b`, options),
	};
}

export async function updateUser(id: string, data: Record<string, unknown>): Promise<void> {
	await directusRequest('PATCH', `/users/${id}`, data);
}

/** Deletes every user, role and policy this process created. Call from afterAll. */
export async function cleanupFixtures(): Promise<void> {
	if (created.users.length) await directusRequest('DELETE', '/users', created.users.splice(0));
	if (created.roles.length) await directusRequest('DELETE', '/roles', created.roles.splice(0));
	if (created.policies.length) await directusRequest('DELETE', '/policies', created.policies.splice(0));
}

/** Changes directus_settings through Directus and returns a function that puts the old values back. */
export async function setSettings(values: Record<string, unknown>): Promise<() => Promise<void>> {
	const fields = Object.keys(values).join(',');
	const { data: before } = await directusRequest('GET', `/settings?fields=${fields}`);
	await directusRequest('PATCH', '/settings', values);
	return async () => {
		await directusRequest('PATCH', '/settings', before);
	};
}
