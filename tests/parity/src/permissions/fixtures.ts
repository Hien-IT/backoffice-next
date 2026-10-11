// Ported from directus/tests/blackbox/common/functions.ts (CreateRole, CreateUser, CreatePolicy, CreatePermission,
// DeletePermission), then helpers of feature 004 (spec FR-100, FR-101, research R13).
// Backoffice: every helper takes the app whose API makes the fixture (write flows compare one fixture per app) and
// runs as that app's admin instead of the blackbox static tokens; roles are passed by id instead of the ROLE names.
import { randomUUID } from 'node:crypto';
import { type AppName, appRequest } from '../directus-api.js';

export type { AppName };
export const APP_NAMES: AppName[] = ['directus', 'backoffice'];

export interface Permission {
	collection: string;
	action: 'create' | 'read' | 'update' | 'delete' | 'share';
	permissions?: Record<string, unknown> | null;
	validation?: Record<string, unknown> | null;
	presets?: Record<string, unknown> | null;
	fields?: string[] | null;
}

interface Created {
	users: string[];
	roles: string[];
	policies: string[];
	access: string[];
	fields: [collection: string, field: string][];
	collections: string[];
}

const created: Created = { users: [], roles: [], policies: [], access: [], fields: [], collections: [] };

export const uniqueName = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8)}`;

// --- Ported blackbox helpers -------------------------------------------------------------------------------------

export type OptionsCreateRole = { name: string; parent?: string | null };

export async function CreateRole(app: AppName, options: OptionsCreateRole): Promise<{ id: string; name: string }> {
	const existing = await appRequest(app, 'GET', `/roles?filter=${json({ name: { _eq: options.name } })}`);
	if (existing.data.length > 0) return existing.data[0];

	const response = await appRequest(app, 'POST', '/roles', {
		name: options.name,
		...(options.parent !== undefined ? { parent: options.parent } : {}),
	});

	created.roles.push(response.data.id);
	return response.data;
}

export type OptionsCreateUser = {
	email: string;
	password?: string;
	token?: string;
	role?: string | null;
	status?: string;
	first_name?: string;
	last_name?: string;
	[field: string]: unknown;
};

export async function CreateUser(app: AppName, options: OptionsCreateUser): Promise<{ id: string; email: string }> {
	const response = await appRequest(app, 'POST', '/users', options);
	created.users.push(response.data.id);
	return response.data;
}

export type OptionsCreatePolicy = {
	name: string;
	appAccessEnabled: boolean;
	adminAccessEnabled: boolean;
	role?: string | { id: string };
	enforceTfa?: boolean;
	ipAccess?: string[] | null;
};

export async function CreatePolicy(app: AppName, options: OptionsCreatePolicy): Promise<{ id: string; name: string }> {
	const existing = await appRequest(app, 'GET', `/policies?filter=${json({ name: { _eq: options.name } })}`);
	if (existing.data.length > 0) return existing.data[0];

	const response = await appRequest(app, 'POST', '/policies', {
		name: options.name,
		app_access: options.appAccessEnabled,
		admin_access: options.adminAccessEnabled,
		...(options.enforceTfa !== undefined ? { enforce_tfa: options.enforceTfa } : {}),
		...(options.ipAccess !== undefined ? { ip_access: options.ipAccess } : {}),
	});

	const policy = response.data;
	created.policies.push(policy.id);

	const roleId = typeof options.role === 'object' ? options.role.id : options.role;

	if (roleId) {
		const access = await appRequest(app, 'POST', '/access', { role: roleId, policy: policy.id });
		created.access.push(access.data.id);
	}

	return policy;
}

export type OptionsCreatePermission = {
	role: string;
	permissions: Permission[];
	policy?: string;
	policyName?: string;
};

/** Nested write of permissions through PATCH /policies/:id, like the blackbox fixture (spec US3.5). */
export async function CreatePermission(app: AppName, options: OptionsCreatePermission): Promise<any> {
	let policyId = options.policy;

	if (!policyId) {
		const policy = await CreatePolicy(app, {
			role: options.role,
			adminAccessEnabled: false,
			appAccessEnabled: false,
			name: options.policyName ? `${options.role}-${options.policyName}` : `${options.role}-${randomUUID()}`,
		});

		policyId = policy.id;
	}

	const response = await appRequest(app, 'PATCH', `/policies/${policyId}`, {
		permissions: {
			create: options.permissions.map((p) => ({ ...p, policy: policyId })),
			update: [],
			delete: [],
		},
	});

	return response.data;
}

export type OptionsDeletePermission = { policyId: string };

export async function DeletePermission(app: AppName, { policyId }: OptionsDeletePermission): Promise<any> {
	return appRequest(app, 'DELETE', `/policies/${policyId}`);
}

// --- Feature 004 helpers -----------------------------------------------------------------------------------------

export interface RoleTree {
	root: string;
	middle: string;
	leaf: string;
}

/** Three nested roles: leaf.parent = middle, middle.parent = root (spec US1.1). */
export async function createRoleTree(app: AppName, prefix: string): Promise<RoleTree> {
	const root = await CreateRole(app, { name: uniqueName(`${prefix}-root`) });
	const middle = await CreateRole(app, { name: uniqueName(`${prefix}-middle`), parent: root.id });
	const leaf = await CreateRole(app, { name: uniqueName(`${prefix}-leaf`), parent: middle.id });
	return { root: root.id, middle: middle.id, leaf: leaf.id };
}

export interface PolicyOptions {
	admin?: boolean;
	app?: boolean;
	enforceTfa?: boolean;
	ipAccess?: string[] | null;
	permissions?: Permission[];
}

/** A policy with its permissions written in the same request (nested o2m), not attached yet. */
export async function createPolicy(app: AppName, prefix: string, options: PolicyOptions = {}): Promise<string> {
	const response = await appRequest(app, 'POST', '/policies', {
		name: uniqueName(prefix),
		admin_access: options.admin ?? false,
		app_access: options.app ?? false,
		enforce_tfa: options.enforceTfa ?? false,
		ip_access: options.ipAccess ?? null,
		...(options.permissions ? { permissions: options.permissions } : {}),
	});

	created.policies.push(response.data.id);
	return response.data.id;
}

/** Attaches a policy to a role, a user, or the public role when both are null (spec FR-072). */
export async function attachPolicy(
	app: AppName,
	policy: string,
	target: { role?: string | null; user?: string | null },
): Promise<string> {
	const response = await appRequest(app, 'POST', '/access', {
		policy,
		role: target.role ?? null,
		user: target.user ?? null,
	});

	created.access.push(response.data.id);
	return response.data.id;
}

export interface TestUser {
	id: string;
	email: string;
	password: string;
	token: string;
}

export const TEST_PASSWORD = 'parity-password-1';

/** An active user with a password and a static token, so cases can use a JWT or the static token (spec FR-101). */
export async function createUser(
	app: AppName,
	prefix: string,
	options: Omit<OptionsCreateUser, 'email'> = {},
): Promise<TestUser> {
	const email = `${uniqueName(prefix)}@example.com`.toLowerCase();
	const token = `static-${randomUUID()}`;
	const password = TEST_PASSWORD;
	const user = await CreateUser(app, { email, password, token, status: 'active', ...options });
	return { id: user.id, email, password, token };
}

/** A user collection made through Directus (/collections is feature 006), removed by cleanup(). */
export async function createUserCollection(name: string, fields: Record<string, unknown>[] = []): Promise<string> {
	await appRequest('directus', 'POST', '/collections', {
		collection: name,
		schema: {},
		meta: { hidden: true },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			...fields,
		],
	});

	created.collections.push(name);
	return name;
}

/** A field added to any collection (custom fields of directus_users included) through Directus, removed by cleanup(). */
export async function createField(collection: string, field: Record<string, unknown>): Promise<string> {
	await appRequest('directus', 'POST', `/fields/${collection}`, field);
	created.fields.push([collection, field['field'] as string]);
	return field['field'] as string;
}

/** A share made at Directus (/shares is feature 010); returns its id. */
export async function createShare(collection: string, item: string | number, data: Record<string, unknown> = {}) {
	const share = await appRequest('directus', 'POST', '/shares', { name: 'parity', collection, item, ...data });
	return share.data.id as string;
}

/** Deletes everything this process created, newest first, through Directus (same DB for both apps). */
export async function cleanup(): Promise<void> {
	if (created.users.length) await appRequest('directus', 'DELETE', '/users', created.users.splice(0));
	if (created.access.length) await deleteExisting('/access', created.access.splice(0));
	if (created.policies.length) await deleteExisting('/policies', created.policies.splice(0));
	if (created.roles.length) await deleteExisting('/roles', created.roles.splice(0).reverse());

	for (const [collection, field] of created.fields.splice(0).reverse()) {
		await appRequest('directus', 'DELETE', `/fields/${collection}/${field}`);
	}

	for (const collection of created.collections.splice(0).reverse()) {
		await appRequest('directus', 'DELETE', `/collections/${collection}`);
	}
}

/** Access rows go away with their policy (ON DELETE CASCADE), so only delete what is still there. */
async function deleteExisting(path: string, keys: string[]): Promise<void> {
	// SEARCH: hundreds of keys in a GET filter pass the URL size the server accepts.
	const { data } = await appRequest('directus', 'SEARCH', path, {
		query: { filter: { id: { _in: keys } }, fields: ['id'], limit: -1 },
	});
	const existing = (data as { id: string }[]).map((row) => row.id);
	if (existing.length) await appRequest('directus', 'DELETE', path, existing);
}

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
