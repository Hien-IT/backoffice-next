// Permission matrix of spec FR-101 (research R13): the full product of five dimensions, generated, never written by
// hand. Cells are grouped by fixture (accountability × permission config × ip_access) so a group builds its users,
// roles and policies once and then runs its 30 cells (5 actions × 6 collections).

export const ACCOUNTABILITIES = [
	'public', // no token
	'user-no-role',
	'role', // one-level role, no app_access
	'role-app', // one-level role with app_access
	'role-tree', // three nested roles, permissions on root, middle and leaf
	'user-policy', // policy attached to the user, not through a role
	'admin-role', // admin_access through a role policy
	'admin-user', // admin_access through a user policy
	'static-token', // static token of a one-level role user
	'share', // share token made at Directus on a user collection
] as const;

export const PERMISSION_CONFIGS = [
	'none',
	'full', // empty filter, fields ['*']
	'filter', // field compared with a constant
	'current-user',
	'current-role',
	'current-roles',
	'current-policies',
	'current-user-field', // $CURRENT_USER.<relation>.<field>
	'now', // $NOW(-1 day)
	'partial-fields',
	'validation',
	'presets',
	'two-policies', // two policies on the same collection and action with other fields and filters
] as const;

export const IP_ACCESS = ['null', 'ip-match', 'ip-miss', 'range-match', 'cidr-miss'] as const;

export const ACTIONS = ['create', 'read', 'update', 'delete', 'share'] as const;

export const COLLECTIONS = [
	'directus_users',
	'directus_users-custom', // custom fields added through Directus, with an m2o to a user collection
	'directus_roles',
	'directus_policies',
	'directus_access',
	'directus_permissions',
] as const;

export type Accountability = (typeof ACCOUNTABILITIES)[number];
export type PermissionConfig = (typeof PERMISSION_CONFIGS)[number];
export type IpAccess = (typeof IP_ACCESS)[number];
export type Action = (typeof ACTIONS)[number];
export type Collection = (typeof COLLECTIONS)[number];

export interface Cell {
	accountability: Accountability;
	permission: PermissionConfig;
	ip: IpAccess;
	action: Action;
	collection: Collection;
}

export interface Group {
	index: number;
	accountability: Accountability;
	permission: PermissionConfig;
	ip: IpAccess;
	cells: Cell[];
}

export interface RequestTemplate {
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	/** `{endpoint}` is the REST path of the collection, `{pk}` the key of the target item. */
	path: string;
	body?: 'item';
}

/** Fixed requests per action (spec FR-101 item 4). */
export const REQUESTS: Record<Action, RequestTemplate[]> = {
	create: [{ method: 'POST', path: '{endpoint}', body: 'item' }],
	read: [
		{ method: 'GET', path: '{endpoint}?fields=*' },
		{ method: 'GET', path: '{endpoint}/{pk}' },
	],
	update: [{ method: 'PATCH', path: '{endpoint}/{pk}', body: 'item' }],
	delete: [{ method: 'DELETE', path: '{endpoint}/{pk}' }],
	share: [{ method: 'GET', path: '/permissions/me/{collection}/{pk}' }],
};

export const cellId = (c: Cell) => `${c.accountability}|${c.permission}|${c.ip}|${c.action}|${c.collection}`;

export function groups(): Group[] {
	const result: Group[] = [];

	for (const accountability of ACCOUNTABILITIES) {
		for (const permission of PERMISSION_CONFIGS) {
			for (const ip of IP_ACCESS) {
				const cells = ACTIONS.flatMap((action) =>
					COLLECTIONS.map((collection) => ({ accountability, permission, ip, action, collection })),
				);

				result.push({ index: result.length, accountability, permission, ip, cells });
			}
		}
	}

	return result;
}

export function allCells(): Cell[] {
	return groups().flatMap((group) => group.cells);
}

/** Parses PARITY_MATRIX_SHARD="<i>/<n>" (1-based); no value means one shard with every group. */
export function parseShard(value = process.env['PARITY_MATRIX_SHARD']): { index: number; count: number } {
	if (value === undefined || value === '') return { index: 1, count: 1 };
	const match = /^(\d+)\/(\d+)$/.exec(value);
	const index = Number(match?.[1]);
	const count = Number(match?.[2]);

	if (!match || count < 1 || index < 1 || index > count) {
		throw new Error(`PARITY_MATRIX_SHARD must look like "<i>/<n>" with 1 <= i <= n, got "${value}"`);
	}

	return { index, count };
}

/** Groups of one shard: group k belongs to shard (k mod n) + 1, so shards get the same mix of dimensions. */
export function shardGroups(shard = parseShard()): Group[] {
	return groups().filter((group) => group.index % shard.count === shard.index - 1);
}

/**
 * Reduced matrix for MySQL and SQLite (spec SC-001): every value of every fixture dimension appears at least once,
 * with the read and update actions on directus_users only.
 */
export function eachChoice(): Cell[] {
	const rows = Math.max(ACCOUNTABILITIES.length, PERMISSION_CONFIGS.length, IP_ACCESS.length);
	const cells: Cell[] = [];

	for (let i = 0; i < rows; i++) {
		for (const action of ['read', 'update'] as const) {
			cells.push({
				accountability: ACCOUNTABILITIES[i % ACCOUNTABILITIES.length]!,
				permission: PERMISSION_CONFIGS[i % PERMISSION_CONFIGS.length]!,
				ip: IP_ACCESS[i % IP_ACCESS.length]!,
				action,
				collection: 'directus_users',
			});
		}
	}

	return cells;
}
