// Seed of the auth benchmark (SC-007, research R12 of spec 003), Postgres only: a role with app access made through
// the Directus API, then with knex on the host 2,000 `default` users sharing one argon2 hash (copied from a user
// Directus made), 2,000 users of a `benchmark` provider (no password) and, per round, a batch of sessions.
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import knex, { type Knex } from 'knex';

const DIRECTUS = process.env['DIRECTUS_URL'] ?? 'http://127.0.0.1:8155';
export const USERS = 2000;
export const PASSWORD = 'bench-auth-password';

const env = readFileSync(new URL('../../parity/env/postgres.env', import.meta.url), 'utf8');
const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';

/** SECRET both apps sign with (env/postgres.env of the parity environment). */
export const SECRET = envValue('SECRET');

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

	// A run lasts longer than ACCESS_TOKEN_TTL (cleanup failed with "Token expired"): log in again once, like
	// seed-permissions.ts.
	if (res.status === 401 && adminToken) {
		adminToken = undefined;
		return directus(method, path, body);
	}

	if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
	return res.status === 204 ? undefined : res.json();
}

export interface Seed {
	role: string;
	policy: string;
	/** Email of the i-th `default` user. */
	email: (i: number) => string;
	/** Ids of the `default` users and of the `benchmark` provider users. */
	local: string[];
	provider: string[];
}

export async function seed(): Promise<Seed> {
	const tag = randomBytes(3).toString('hex');
	const policy = (await directus('POST', '/policies', { name: `bench-auth-${tag}`, icon: 'badge', app_access: true }))
		.data.id;
	const role = (await directus('POST', '/roles', { name: `bench-auth-${tag}`, icon: 'person' })).data.id;
	await directus('POST', '/access', { role, policy });

	const email = (i: number) => `bench-auth-${tag}-${i}@example.com`;
	const template = (await directus('POST', '/users', { email: email(-1), password: PASSWORD, role })).data.id;
	const { password: hash } = await db('directus_users').select('password').where({ id: template }).first();
	await directus('DELETE', `/users/${template}`);

	const local = Array.from({ length: USERS }, () => randomUUID());
	const provider = Array.from({ length: USERS }, () => randomUUID());

	const rows = [
		...local.map((id, i) => ({ id, email: email(i), password: hash, role, status: 'active', provider: 'default' })),
		...provider.map((id, i) => ({
			id,
			email: `bench-sso-${tag}-${i}@example.com`,
			role,
			status: 'active',
			provider: 'benchmark',
			external_identifier: `bench-${tag}-${i}`,
		})),
	];

	await db.batchInsert('directus_users', rows, 500);
	return { role, policy, email, local, provider };
}

/** One new session per `default` user (refresh rotates them, so each measured run takes a fresh batch). */
export async function sessions(seeded: Seed): Promise<string[]> {
	const expires = new Date(Date.now() + 24 * 3600 * 1000);
	const tokens = seeded.local.map(() => randomBytes(48).toString('base64url').slice(0, 64));
	await db.batchInsert(
		'directus_sessions',
		tokens.map((token, i) => ({ token, user: seeded.local[i]!, expires })),
		500,
	);
	return tokens;
}

export async function cleanup(seeded: Seed): Promise<void> {
	const users = [...seeded.local, ...seeded.provider];

	for (let i = 0; i < users.length; i += 500) {
		const chunk = users.slice(i, i + 500);
		await db('directus_sessions').whereIn('user', chunk).delete();
		await db('directus_activity').whereIn('user', chunk).delete();
		await db('directus_users').whereIn('id', chunk).delete();
	}

	await directus('DELETE', `/roles/${seeded.role}`);
	await directus('DELETE', `/policies/${seeded.policy}`);
	await db.destroy();
}
