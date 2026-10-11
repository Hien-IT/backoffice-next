// Feature 004, US7 (FR-082, FR-083, SC-003): the caches each write clears, observed from Redis at each app. Before a
// write, a request of a user whose permission resolves $CURRENT_USER.role.name fills the permissions cache
// (`permissions:*`) and a filter-context entry of the data cache (`sets:namespace:system-cache:system-cache:filter-context-*`); during the write
// the test listens to `directus:bus:schemaChanged` (clearSystemCache publishes it). Then the same for the other app.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { type ScenarioContext, scenario, send } from '../auth/scenario.js';
import { adminToken, type AppName, appRequest, appUrl } from '../directus-api.js';
import { closeRedis, newConnection, redis } from '../redis.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createRoleTree,
	createUser,
	type TestUser,
	uniqueName,
} from './fixtures.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
let reader: TestUser;

beforeAll(async () => {
	const { leaf } = await createRoleTree('directus', 'parity-cache-cross');

	await attachPolicy(
		'directus',
		await createPolicy('directus', 'parity-cache-cross', {
			permissions: [
				{
					collection: 'directus_users',
					action: 'read',
					fields: ['id'],
					permissions: { role: { name: { _eq: '$CURRENT_USER.role.name' } } },
				},
			],
		}),
		{ role: leaf },
	);

	reader = await createUser('directus', 'parity-cache-cross', { role: leaf });
}, 60_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
	await closeRedis();
}, 60_000);

const count = async (match: string) => {
	let n = 0;
	for await (const keys of redis().scanStream({ match, count: 500 })) n += (keys as string[]).length;
	return n;
};

interface Cleared {
	permissions: boolean;
	data: boolean;
	schemaChanged: boolean;
}

/** Fills both caches through `ctx`'s app, runs `write`, and tells which caches were cleared. */
async function observe(ctx: ScenarioContext, write: () => Promise<unknown>): Promise<Cleared> {
	const res = await send(
		ctx.url,
		{ path: '/users?fields=id', headers: { authorization: `Bearer ${reader.token}` } },
		ctx.host,
	);
	expect(res.status).toBe(200);
	await new Promise((resolve) => setTimeout(resolve, 300));
	expect(await count('permissions:*')).toBeGreaterThan(0);
	expect(await count('sets:namespace:system-cache:system-cache:filter-context-*')).toBeGreaterThan(0);

	const sub = newConnection();
	let messages = 0;
	await sub.subscribe('directus:bus:schemaChanged');
	sub.on('message', () => messages++);

	await write();
	await new Promise((resolve) => setTimeout(resolve, 500));
	await sub.quit();

	return {
		permissions: (await count('permissions:*')) === 0,
		data: (await count('sets:namespace:system-cache:system-cache:filter-context-*')) === 0,
		schemaChanged: messages > 0,
	};
}

const admin = (app: AppName, method: string, path: string, body?: unknown) => appRequest(app, method, path, body);

type Row = [label: string, expected: Cleared, run: (app: AppName, name: string) => Promise<() => Promise<unknown>>];

const ALL: Cleared = { permissions: true, data: true, schemaChanged: true };
// CACHE_AUTO_PURGE=true in the parity env: every write through the engine also clears the data cache (FR-083).
const PERMISSIONS_ONLY: Cleared = { permissions: true, data: true, schemaChanged: false };
const AUTO_PURGE_ONLY: Cleared = { permissions: false, data: true, schemaChanged: false };
const NONE: Cleared = { permissions: false, data: false, schemaChanged: false };

/** Each row prepares its fixture (through the app under test) and returns the write to observe. */
const ROWS: Row[] = [
	[
		'create access',
		ALL,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () => admin(app, 'POST', '/access', { policy });
		},
	],
	[
		'update access',
		ALL,
		async (app, name) => {
			const access = await attachPolicy(app, await createPolicy(app, name), {});
			return () => admin(app, 'PATCH', `/access/${access}`, { sort: 3 });
		},
	],
	[
		'delete access',
		ALL,
		async (app, name) => {
			const access = await attachPolicy(app, await createPolicy(app, name), {});
			return () => admin(app, 'DELETE', `/access/${access}`);
		},
	],
	['create policy', PERMISSIONS_ONLY, async (app, name) => () => admin(app, 'POST', '/policies', { name })],
	[
		'update policy flags',
		ALL,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () => admin(app, 'PATCH', `/policies/${policy}`, { app_access: true });
		},
	],
	[
		'update policy name',
		AUTO_PURGE_ONLY,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () => admin(app, 'PATCH', `/policies/${policy}`, { name: `${name}-renamed` });
		},
	],
	[
		'delete policy',
		ALL,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () => admin(app, 'DELETE', `/policies/${policy}`);
		},
	],
	[
		'create permission',
		ALL,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () =>
				admin(app, 'POST', '/permissions', { policy, collection: 'directus_roles', action: 'read', fields: ['id'] });
		},
	],
	[
		'nested permissions through PATCH /policies/:id',
		ALL,
		async (app, name) => {
			const policy = await createPolicy(app, name);
			return () =>
				admin(app, 'PATCH', `/policies/${policy}`, {
					permissions: {
						create: [{ collection: 'directus_roles', action: 'read', fields: ['id'] }],
						update: [],
						delete: [],
					},
				});
		},
	],
	[
		'update role parent',
		ALL,
		async (app, name) => {
			const tree = await createRoleTree(app, name);
			return () => admin(app, 'PATCH', `/roles/${tree.leaf}`, { parent: tree.root });
		},
	],
	[
		'update role without parent',
		AUTO_PURGE_ONLY,
		async (app, name) => {
			const tree = await createRoleTree(app, name);
			return () => admin(app, 'PATCH', `/roles/${tree.leaf}`, { icon: 'star' });
		},
	],
	[
		'delete role',
		ALL,
		async (app, name) => {
			const tree = await createRoleTree(app, name);
			return () => admin(app, 'DELETE', `/roles/${tree.leaf}`);
		},
	],
	[
		'update user role',
		ALL,
		async (app, name) => {
			const user = await createUser(app, name, { role: null });
			const tree = await createRoleTree(app, name);
			return () => admin(app, 'PATCH', `/users/${user.id}`, { role: tree.leaf });
		},
	],
	[
		'nested users through PATCH /roles/:id',
		ALL,
		async (app, name) => {
			const user = await createUser(app, name, { role: null });
			const tree = await createRoleTree(app, name);
			return () => admin(app, 'PATCH', `/roles/${tree.leaf}`, { users: [user.id] });
		},
	],
	[
		'FR-083: track page clears no cache',
		NONE,
		async (app, name) => {
			const user = await createUser(app, name, { role: null });
			return () =>
				fetch(new URL('/users/me/track/page', appUrl(app)), {
					method: 'PATCH',
					headers: { authorization: `Bearer ${user.token}`, 'content-type': 'application/json' },
					body: JSON.stringify({ last_page: '/content' }),
				});
		},
	],
];

describe.runIf(suite === 'full')('FR-082, FR-083: caches cleared by each write', () => {
	it.each(ROWS)('%s', async (label, expected, prepare) => {
		const prefix = uniqueName('parity-cache-row');

		const results = await scenario(urls(), async (ctx) => {
			const write = await prepare(ctx.app, `${prefix}-${ctx.app}`);
			return observe(ctx, write);
		});

		expect(results.backoffice, label).toEqual(results.directus);
		expect(results.directus, label).toEqual(expected);
	});
});

describe.runIf(suite === 'full')('SC-003: a permission change at one app applies at the other 200 ms later', () => {
	it.each([
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	] as const)('written at %s, read at %s (20 times)', async (writer, readerApp) => {
		const name = uniqueName('parity-cache-sc003');
		const { leaf } = await createRoleTree('directus', name);
		const policy = await createPolicy('directus', name);
		await attachPolicy('directus', policy, { role: leaf });
		const user = await createUser('directus', name, { role: leaf });
		const read = () =>
			fetch(new URL('/roles?fields=id&limit=1', appUrl(readerApp)), {
				headers: { authorization: `Bearer ${user.token}` },
			});

		await adminToken(writer);
		const outcomes: string[] = [];

		for (let i = 0; i < 20; i++) {
			const created = await appRequest(writer, 'POST', '/permissions', {
				policy,
				collection: 'directus_roles',
				action: 'read',
				fields: ['id'],
			});

			await new Promise((resolve) => setTimeout(resolve, 200));
			outcomes.push(`granted:${(await read()).status}`);

			await appRequest(writer, 'DELETE', `/permissions/${created.data.id}`);
			await new Promise((resolve) => setTimeout(resolve, 200));
			outcomes.push(`revoked:${(await read()).status}`);
		}

		expect(outcomes.filter((o) => o === 'granted:200')).toHaveLength(20);
		expect(outcomes.filter((o) => o === 'revoked:403')).toHaveLength(20);
	});
});
