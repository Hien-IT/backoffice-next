// Seed of the permissions benchmark (SC-006, research R14 of spec 004), Postgres only: three policies made through the
// Directus API, then with knex on the host a role tree (1 root → 10 branches → 100 leaves) and 2,000 active users with
// a static token, spread over the leaves. Each user gets at least three policies: one through the root, one through
// its branch, one attached to the user; their permissions use $CURRENT_USER, $CURRENT_ROLES and $NOW(-1 day).
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import knex, { type Knex } from 'knex';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
export const USERS = 2000;
const BRANCHES = 10;
const LEAVES = 100;

const env = readFileSync(new URL('../../parity/env/postgres.env', import.meta.url), 'utf8');
const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';

export const db: Knex = knex({
	client: 'pg',
	connection: { host: '127.0.0.1', port: 6100, database: 'directus', user: 'postgres', password: 'secret' },
	pool: { min: 0, max: 4 },
});

let adminToken: string | undefined;

async function directus(method: string, path: string, body?: unknown): Promise<any> {
	if (!adminToken) {
		const res = await fetch(`${DIRECTUS}/auth/login`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: envValue('ADMIN_EMAIL'), password: envValue('ADMIN_PASSWORD') }),
		});

		adminToken = ((await res.json()) as any).data.access_token;
	}

	const res = await fetch(`${DIRECTUS}${path}`, {
		method,
		headers: { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});

	if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
	return res.status === 204 ? undefined : res.json();
}

export interface Seed {
	tag: string;
	/** Static tokens of the users, in order. */
	tokens: string[];
}

const fields = ['id', 'email', 'first_name', 'last_name', 'role', 'status', 'last_access'];

export async function seed(): Promise<Seed> {
	const tag = `bench-perm-${randomBytes(3).toString('hex')}`;

	const policy = async (suffix: string, permissions: unknown[], app = false) =>
		(await directus('POST', '/policies', { name: `${tag}-${suffix}`, icon: 'badge', app_access: app, permissions }))
			.data.id as string;

	const root = await policy(
		'root',
		[{ collection: 'directus_users', action: 'read', fields, permissions: { role: { _in: '$CURRENT_ROLES' } } }],
		true,
	);

	const branch = await policy('branch', [
		{
			collection: 'directus_roles',
			action: 'read',
			fields: ['id', 'name', 'parent'],
			permissions: { id: { _in: '$CURRENT_ROLES' } },
		},
	]);

	const own = await policy('user', [
		{
			collection: 'directus_users',
			action: 'read',
			fields: ['*'],
			permissions: { _or: [{ id: { _eq: '$CURRENT_USER' } }, { last_access: { _gte: '$NOW(-1 day)' } }] },
		},
	]);

	// Role tree, users and access rows with knex (a few thousand rows: the API would take minutes).
	const rootRole = randomUUID();
	const branches = Array.from({ length: BRANCHES }, () => randomUUID());
	const leaves = Array.from({ length: LEAVES }, () => randomUUID());

	await db('directus_roles').insert([
		{ id: rootRole, name: `${tag}-root`, icon: 'badge' },
		...branches.map((id, i) => ({ id, name: `${tag}-branch-${i}`, icon: 'badge', parent: rootRole })),
		...leaves.map((id, i) => ({ id, name: `${tag}-leaf-${i}`, icon: 'badge', parent: branches[i % BRANCHES] })),
	]);

	const users = Array.from({ length: USERS }, (_, i) => ({
		id: randomUUID(),
		email: `${tag}-${i}@example.com`,
		status: 'active',
		role: leaves[i % LEAVES],
		token: `${tag}-token-${i}`,
		provider: 'default',
	}));

	for (let i = 0; i < users.length; i += 500) await db('directus_users').insert(users.slice(i, i + 500));

	const access = [
		{ id: randomUUID(), role: rootRole, policy: root },
		...branches.map((role) => ({ id: randomUUID(), role, policy: branch })),
		...users.map((user) => ({ id: randomUUID(), user: user.id, policy: own })),
	];

	for (let i = 0; i < access.length; i += 500) await db('directus_access').insert(access.slice(i, i + 500));

	return { tag, tokens: users.map((user) => user.token) };
}

export async function cleanup(seeded: Seed): Promise<void> {
	const like = `${seeded.tag}%`;
	await db('directus_access')
		.whereIn('user', db('directus_users').select('id').where('email', 'like', like))
		.delete();
	await db('directus_users').where('email', 'like', like).delete();
	await db('directus_access')
		.whereIn('role', db('directus_roles').select('id').where('name', 'like', like))
		.delete();
	await db('directus_roles').where('name', 'like', `${seeded.tag}-leaf-%`).delete();
	await db('directus_roles').where('name', 'like', `${seeded.tag}-branch-%`).delete();
	await db('directus_roles').where('name', 'like', like).delete();
	const policies = (await db('directus_policies').select('id').where('name', 'like', like)).map((p) => p.id);
	for (const id of policies) await directus('DELETE', `/policies/${id}`);
	await db.destroy();
}
