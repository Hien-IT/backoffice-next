// Feature 004, FR-101 (research R13): runs the cells of the permission matrix. A group (accountability × permission
// config × ip_access) builds its fixture once at Directus: a policy holding the config for every collection and
// action (25 rows: directus_users serves both the system-field and the custom-field cells), attached the way the
// accountability says, and a user (or the public role, or a share). Read and share cells compare one request sent
// to both apps at once on shared targets (parity()); create, update and delete cells run at each app on targets of
// that app (scenario()) and compare the responses and the rows they wrote.
import { signAccessToken } from '../auth/tokens.js';
import { urls } from '../auth/fixtures.js';
import { compareTranscripts, scenario } from '../auth/scenario.js';
import { type AppName, appRequest, appUrl } from '../directus-api.js';
import { capture, parity, report } from '../parity.js';
import { hostDb } from '../auth/db-effects.js';
import {
	attachPolicy,
	createPolicy,
	createRoleTree,
	createShare,
	createUser,
	type Permission,
	uniqueName,
} from './fixtures.js';
import { startFlow } from './flow.js';
import type { Action, Cell, Collection, Group, PermissionConfig } from './matrix.js';

/** Client IP of every matrix request (X-Forwarded-For; IP_TRUST_PROXY is on by default). */
export const MATRIX_IP = '10.77.0.5';

const IP_VALUES: Record<string, string[] | null> = {
	null: null,
	'ip-match': [MATRIX_IP],
	'ip-miss': ['10.78.0.5'],
	'range-match': ['10.77.0.1-10.77.0.9'],
	'cidr-miss': ['10.79.0.0/16'],
};

export const REF_COLLECTION = 'parity_matrix_ref';

type RealCollection =
	| 'directus_users'
	| 'directus_roles'
	| 'directus_policies'
	| 'directus_access'
	| 'directus_permissions';

interface CollectionInfo {
	real: RealCollection;
	endpoint: string;
	/** Path from a row of the collection to a user, for the filters on the current user. */
	userPath: string;
	/** Field compared with a constant ("filter") and used by the validation. */
	nameFilter: Record<string, unknown>;
	partial: string[];
	preset: Record<string, unknown>;
	validation: Record<string, unknown>;
	readFields: string;
	body: (name: string, t: Targets) => Record<string, unknown>;
	update: (t: Targets) => Record<string, unknown>;
}

export interface Targets {
	user: string;
	role: string;
	policy: string;
	access: string;
	permission: number;
	ref: number;
}

const INFO: Record<Collection, CollectionInfo> = {
	directus_users: {
		real: 'directus_users',
		endpoint: '/users',
		userPath: '',
		nameFilter: { email: { _starts_with: 'parity-matrix' } },
		partial: ['id', 'email', 'parity_matrix_note'],
		preset: { title: 'preset' },
		validation: { email: { _starts_with: 'never' } },
		readFields: '*',
		body: (name) => ({ email: `${name}@example.com`, title: 'created' }),
		update: () => ({ title: 'updated' }),
	},
	'directus_users-custom': {
		real: 'directus_users',
		endpoint: '/users',
		userPath: '',
		nameFilter: { email: { _starts_with: 'parity-matrix' } },
		partial: ['id', 'email', 'parity_matrix_note'],
		preset: { title: 'preset' },
		validation: { email: { _starts_with: 'never' } },
		readFields: 'id,parity_matrix_note,parity_matrix_ref.*',
		body: (name, t) => ({ email: `${name}@example.com`, parity_matrix_note: 'n', parity_matrix_ref: t.ref }),
		update: (t) => ({ parity_matrix_note: 'u', parity_matrix_ref: t.ref }),
	},
	directus_roles: {
		real: 'directus_roles',
		endpoint: '/roles',
		userPath: 'users',
		nameFilter: { name: { _starts_with: 'parity-matrix' } },
		partial: ['id', 'name'],
		preset: { icon: 'preset' },
		validation: { name: { _starts_with: 'never' } },
		readFields: '*',
		body: (name) => ({ name }),
		update: () => ({ icon: 'updated' }),
	},
	directus_policies: {
		real: 'directus_policies',
		endpoint: '/policies',
		userPath: 'users.user',
		nameFilter: { name: { _starts_with: 'parity-matrix' } },
		partial: ['id', 'name'],
		preset: { description: 'preset' },
		validation: { name: { _starts_with: 'never' } },
		readFields: '*',
		body: (name) => ({ name }),
		update: () => ({ description: 'updated' }),
	},
	directus_access: {
		real: 'directus_access',
		endpoint: '/access',
		userPath: 'user',
		nameFilter: { policy: { name: { _starts_with: 'parity-matrix' } } },
		partial: ['id', 'policy'],
		preset: { sort: 7 },
		validation: { sort: { _eq: 99 } },
		readFields: '*',
		// A sort of its own: rows of the same role or policy with equal sorts would come back in the order of their ids.
		body: (_name, t) => ({ policy: t.policy, role: t.role, sort: 1 }),
		update: () => ({ sort: 3 }),
	},
	directus_permissions: {
		real: 'directus_permissions',
		endpoint: '/permissions',
		userPath: 'policy.users.user',
		nameFilter: { collection: { _eq: REF_COLLECTION } },
		partial: ['id', 'collection'],
		preset: { fields: ['id'] },
		validation: { collection: { _eq: 'never' } },
		readFields: '*',
		body: (_name, t) => ({ policy: t.policy, collection: REF_COLLECTION, action: 'read' }),
		update: () => ({ fields: ['id'] }),
	},
};

/** Short collection names for the rows a cell creates (emails have a 64 characters local part). */
const SHORT: Record<Collection, string> = {
	directus_users: 'u',
	'directus_users-custom': 'uc',
	directus_roles: 'r',
	directus_policies: 'p',
	directus_access: 'a',
	directus_permissions: 'pm',
};

const REAL: RealCollection[] = [
	'directus_users',
	'directus_roles',
	'directus_policies',
	'directus_access',
	'directus_permissions',
];

/** `{a: {b: value}}` from the path `a.b`; an empty path returns `value`. */
function at(path: string, value: Record<string, unknown>): Record<string, unknown> {
	return path
		.split('.')
		.filter(Boolean)
		.reduceRight((inner, key) => ({ [key]: inner }), value);
}

function rowFor(config: PermissionConfig, collection: RealCollection, action: Action): Permission | null {
	const info = INFO[collection];
	const toUser = (field: string, condition: Record<string, unknown>) => at(info.userPath, at(field, condition));
	const base = { collection, action, fields: ['*'], permissions: {} as Record<string, unknown> };

	switch (config) {
		case 'none':
			return null;
		case 'full':
		case 'two-policies':
			return base;
		case 'filter':
			return { ...base, permissions: info.nameFilter };
		case 'current-user':
			return { ...base, permissions: toUser('id', { _eq: '$CURRENT_USER' }) };
		case 'current-role':
			return { ...base, permissions: toUser('role', { _eq: '$CURRENT_ROLE' }) };
		case 'current-roles':
			return { ...base, permissions: toUser('role', { _in: '$CURRENT_ROLES' }) };
		case 'current-policies':
			return { ...base, permissions: toUser('policies.policy', { _in: '$CURRENT_POLICIES' }) };
		case 'current-user-field':
			return { ...base, permissions: toUser('role.name', { _eq: '$CURRENT_USER.role.name' }) };
		case 'now':
			return { ...base, permissions: toUser('last_access', { _gte: '$NOW(-1 day)' }) };
		case 'partial-fields':
			return { ...base, fields: info.partial };
		case 'validation':
			return { ...base, validation: info.validation };
		case 'presets':
			return { ...base, presets: info.preset };
	}
}

/** The second policy of `two-policies`: another filter (the current user) and other fields. */
function secondRow(collection: RealCollection, action: Action): Permission {
	const info = INFO[collection];
	return {
		collection,
		action,
		fields: info.partial,
		permissions: at(info.userPath, at('id', { _eq: '$CURRENT_USER' })),
	};
}

const ACTIONS_OF: Action[] = ['create', 'read', 'update', 'delete', 'share'];

function rows(config: PermissionConfig, actions = ACTIONS_OF): Permission[] {
	return REAL.flatMap((c) => actions.map((a) => rowFor(config, c, a)).filter((r): r is Permission => r !== null));
}

export interface GroupFixture {
	headers: Record<string, string>;
	cleanup: () => Promise<void>;
}

/** Builds the accountability of a group at Directus (fixtures of the reads, made once). */
export async function buildGroup(group: Group, refItem: number): Promise<GroupFixture> {
	const name = uniqueName(`parity-matrix-g${group.index}`);
	const ip = IP_VALUES[group.ip]!;
	const ipHeader = { 'x-forwarded-for': MATRIX_IP };
	const cleanups: (() => Promise<unknown>)[] = [];

	const policy = async (suffix: string, permissions: Permission[], extra: { app?: boolean; admin?: boolean } = {}) =>
		createPolicy('directus', `${name}-${suffix}`, { ...extra, ipAccess: ip, permissions });

	const extraPolicies = async (target: { role?: string | null; user?: string | null }) => {
		if (group.permission === 'two-policies') {
			const second = await policy(
				'second',
				REAL.flatMap((c) => ACTIONS_OF.map((a) => secondRow(c, a))),
			);
			await attachPolicy('directus', second, target);
		}
	};

	const jwtFor = (user: { id: string }, role: string | null, app = false, admin = false) => ({
		...ipHeader,
		authorization: `Bearer ${signAccessToken({ id: user.id, role, app_access: app, admin_access: admin })}`,
	});

	switch (group.accountability) {
		case 'public': {
			const p = await policy('public', rows(group.permission));
			const access = await attachPolicy('directus', p, {});
			cleanups.push(() => appRequest('directus', 'DELETE', `/access/${access}`));
			if (group.permission === 'two-policies') {
				const second = await policy(
					'second',
					REAL.flatMap((c) => ACTIONS_OF.map((a) => secondRow(c, a))),
				);
				const access2 = await attachPolicy('directus', second, {});
				cleanups.push(() => appRequest('directus', 'DELETE', `/access/${access2}`));
			}
			return { headers: ipHeader, cleanup: () => runAll(cleanups) };
		}

		case 'user-no-role': {
			const user = await createUser('directus', name, { role: null });
			await attachPolicy('directus', await policy('main', rows(group.permission)), { user: user.id });
			await extraPolicies({ user: user.id });
			return { headers: jwtFor(user, null), cleanup: () => runAll(cleanups) };
		}

		case 'role':
		case 'role-app':
		case 'static-token':
		case 'admin-role':
		case 'admin-user':
		case 'share': {
			const { leaf } = await createRoleTree('directus', name);
			const app = group.accountability === 'role-app';
			await attachPolicy('directus', await policy('main', rows(group.permission), { app }), { role: leaf });
			await extraPolicies({ role: leaf });
			const user = await createUser('directus', name, { role: leaf });

			if (group.accountability === 'admin-role') {
				await attachPolicy('directus', await createPolicy('directus', `${name}-admin`, { admin: true }), {
					role: leaf,
				});
			}

			if (group.accountability === 'admin-user') {
				await attachPolicy('directus', await createPolicy('directus', `${name}-admin`, { admin: true }), {
					user: user.id,
				});
			}

			if (group.accountability === 'static-token') {
				return { headers: { ...ipHeader, authorization: `Bearer ${user.token}` }, cleanup: () => runAll(cleanups) };
			}

			if (group.accountability === 'share') {
				const share = await createShare(REF_COLLECTION, refItem, { role: leaf });
				const auth = await capture(appUrl('directus'), { method: 'POST', path: '/shares/auth', body: { share } });
				cleanups.push(() => appRequest('directus', 'DELETE', `/shares/${share}`));
				return {
					headers: { ...ipHeader, authorization: `Bearer ${(auth.json as any).data.access_token}` },
					cleanup: () => runAll(cleanups),
				};
			}

			const admin = group.accountability.startsWith('admin');
			return { headers: jwtFor(user, leaf, app || admin, admin), cleanup: () => runAll(cleanups) };
		}

		case 'role-tree': {
			const tree = await createRoleTree('directus', name);
			await attachPolicy('directus', await policy('root', rows(group.permission, ['create', 'read'])), {
				role: tree.root,
			});
			await attachPolicy('directus', await policy('middle', rows(group.permission, ['update'])), { role: tree.middle });
			await attachPolicy('directus', await policy('leaf', rows(group.permission, ['delete', 'share'])), {
				role: tree.leaf,
			});
			await extraPolicies({ role: tree.leaf });
			const user = await createUser('directus', name, { role: tree.leaf });
			return { headers: jwtFor(user, tree.leaf), cleanup: () => runAll(cleanups) };
		}

		case 'user-policy': {
			const { leaf } = await createRoleTree('directus', name);
			const user = await createUser('directus', name, { role: leaf });
			await attachPolicy('directus', await policy('main', rows(group.permission)), { user: user.id });
			await extraPolicies({ user: user.id });
			return { headers: jwtFor(user, leaf), cleanup: () => runAll(cleanups) };
		}
	}
}

async function runAll(fns: (() => Promise<unknown>)[]) {
	for (const fn of fns.reverse()) await fn().catch(() => undefined);
}

/** Targets of the reads (shared) or of the writes of one app, made by that app's admin. */
export async function makeTargets(app: AppName, name: string, ref: number): Promise<Targets> {
	const user = (await appRequest(app, 'POST', '/users?fields=id', { email: `${name}-target@example.com` })).data.id;
	const role = (await appRequest(app, 'POST', '/roles?fields=id', { name: `${name}-target` })).data.id;
	const policy = (await appRequest(app, 'POST', '/policies?fields=id', { name: `${name}-target` })).data.id;
	const access = (await appRequest(app, 'POST', '/access?fields=id', { policy, role, sort: 2 })).data.id;
	const permission = (
		await appRequest(app, 'POST', '/permissions?fields=id', { policy, collection: REF_COLLECTION, action: 'read' })
	).data.id;

	return { user, role, policy, access, permission, ref };
}

const pkOf = (collection: Collection, t: Targets): string | number => {
	switch (INFO[collection].real) {
		case 'directus_users':
			return t.user;
		case 'directus_roles':
			return t.role;
		case 'directus_policies':
			return t.policy;
		case 'directus_access':
			return t.access;
		case 'directus_permissions':
			return t.permission;
	}
};

export interface CellFailure {
	cell: string;
	detail: string;
}

/** Read and share cells of a group: one request to both apps at once. */
export async function readCells(cells: Cell[], headers: Record<string, string>, t: Targets): Promise<CellFailure[]> {
	const failures: CellFailure[] = [];

	for (const cell of cells) {
		const info = INFO[cell.collection];
		const pk = pkOf(cell.collection, t);

		const paths =
			cell.action === 'read'
				? [
						`${info.endpoint}?fields=${info.readFields}&sort=id&limit=200`,
						`${info.endpoint}/${pk}?fields=${info.readFields}`,
					]
				: [`/permissions/me/${info.real}/${pk}`];

		for (const path of paths) {
			const text = report(await parity({ path, headers }));
			if (text) failures.push({ cell: `${cellLabel(cell)} GET ${path}`, detail: text });
		}
	}

	return failures;
}

/** Create, update and delete cells of a group at each app on its own targets; responses and rows compared. */
export async function writeCells(
	group: Group,
	cells: Cell[],
	headers: Record<string, string>,
	ref: number,
): Promise<CellFailure[]> {
	const prefix = uniqueName(`parity-matrix-w${group.index}`);

	const transcripts = await scenario(urls(), async (ctx) => {
		const flow = await startFlow(ctx);
		// Same length for both apps (dir, bac): a name too long at one app only would fail validation there only.
		const name = `${prefix}-${ctx.app.slice(0, 3)}`;
		const t = await makeTargets(ctx.app, name, ref);

		for (const [label, id] of Object.entries(t)) {
			if (label !== 'ref') flow.name(id, `target-${label}`);
		}

		for (const cell of cells) {
			const info = INFO[cell.collection];
			const pk = pkOf(cell.collection, t);

			if (cell.action === 'create') {
				const created = await flow.req(
					'POST',
					`${info.endpoint}?fields=*`,
					info.body(`${name}-${SHORT[cell.collection]}`, t),
					headers,
				);

				const id = (created.json as any)?.data?.id;
				if (id !== undefined && id !== null) flow.name(id, `created-${cell.collection}`);
			}

			if (cell.action === 'update') await flow.req('PATCH', `${info.endpoint}/${pk}?fields=*`, info.update(t), headers);
			if (cell.action === 'delete') await flow.req('DELETE', `${info.endpoint}/${pk}`, undefined, headers);
		}

		// Rows the cells made or changed: by name for creations, by key for the targets.
		await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}%`), {
			orderBy: 'email',
			columns: ['email', 'title', 'parity_matrix_note', 'parity_matrix_ref', 'role', 'status'],
		});
		await flow.rows('directus_roles', (q) => q.where('name', 'like', `${name}%`), {
			orderBy: 'name',
			columns: ['name', 'icon', 'parent'],
		});
		await flow.rows('directus_policies', (q) => q.where('name', 'like', `${name}%`), {
			orderBy: 'name',
			columns: ['name', 'description', 'app_access', 'admin_access'],
		});
		await flow.rows(
			'directus_access',
			(q) => q.whereIn('policy', hostDb()('directus_policies').select('id').where('name', 'like', `${name}%`)),
			{ orderBy: 'sort', columns: ['role', 'user', 'policy', 'sort'] },
		);
		await flow.rows(
			'directus_permissions',
			(q) => q.whereIn('policy', hostDb()('directus_policies').select('id').where('name', 'like', `${name}%`)),
			{ orderBy: 'action', columns: ['collection', 'action', 'fields', 'presets'] },
		);
		return flow.transcript();
	});

	// The names of each app's fixture carry the app: give both the same one.
	const named = Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(
				JSON.stringify(t)
					.split(`${prefix}-${app.slice(0, 3)}`)
					.join(`${prefix}-<app>`),
			),
		]),
	) as typeof transcripts;

	const differences = compareTranscripts(named);
	if (differences.length === 0) return [];

	return [
		{
			cell: `group ${group.index} (${group.accountability}|${group.permission}|${group.ip}) writes`,
			detail: differences
				.slice(0, 20)
				.map((d) => `${d.location}: ${JSON.stringify(d.directus)} / ${JSON.stringify(d.backoffice)}`)
				.join('\n'),
		},
	];
}

export const cellLabel = (c: Cell) => `${c.accountability}|${c.permission}|${c.ip}|${c.action}|${c.collection}`;

/** Users, roles and policies the matrix made (prefix parity-matrix), deleted through Directus. */
export async function cleanupMatrix(): Promise<void> {
	const json = (v: unknown) => encodeURIComponent(JSON.stringify(v));

	for (const [path, field] of [
		['/users', 'email'],
		['/policies', 'name'],
		['/roles', 'name'],
	] as const) {
		const { data } = await appRequest(
			'directus',
			'GET',
			`${path}?filter=${json({ [field]: { _starts_with: 'parity-matrix' } })}&fields=id&limit=-1`,
		);

		if (data.length) await appRequest('directus', 'DELETE', path, { keys: data.map((r: any) => r.id) });
	}
}

/** The custom fields of directus_users and the user collection they point to (made once per run). */
export async function setupMatrixSchema(): Promise<number> {
	const { data: existing } = await appRequest('directus', 'GET', `/collections/${REF_COLLECTION}`).catch(() => ({
		data: null,
	}));

	if (!existing) {
		await appRequest('directus', 'POST', '/collections', {
			collection: REF_COLLECTION,
			schema: {},
			meta: { hidden: true },
			fields: [
				{
					field: 'id',
					type: 'integer',
					meta: { hidden: true },
					schema: { is_primary_key: true, has_auto_increment: true },
				},
				{ field: 'label', type: 'string' },
			],
		});

		await appRequest('directus', 'POST', '/fields/directus_users', { field: 'parity_matrix_note', type: 'string' });
		await appRequest('directus', 'POST', '/fields/directus_users', {
			field: 'parity_matrix_ref',
			type: 'integer',
			meta: { special: ['m2o'], interface: 'select-dropdown-m2o' },
			schema: {},
		});
		await appRequest('directus', 'POST', '/relations', {
			collection: 'directus_users',
			field: 'parity_matrix_ref',
			related_collection: REF_COLLECTION,
		});
	}

	return (await appRequest('directus', 'POST', `/items/${REF_COLLECTION}`, { label: 'ref' })).data.id;
}

export async function teardownMatrixSchema(): Promise<void> {
	await appRequest('directus', 'DELETE', '/fields/directus_users/parity_matrix_ref').catch(() => undefined);
	await appRequest('directus', 'DELETE', '/fields/directus_users/parity_matrix_note').catch(() => undefined);
	await appRequest('directus', 'DELETE', `/collections/${REF_COLLECTION}`).catch(() => undefined);
}
