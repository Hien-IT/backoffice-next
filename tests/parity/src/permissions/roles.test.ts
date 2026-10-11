// Feature 004, US3.1, US3.2 and the CRUD of /roles (contracts/permissions-api.md §1): every request form, nested
// writes, the role cycle messages and the cascade of a role deletion, compared with the rows and activity they write.
// Each app runs the same flow with its own fixture (scenario()).
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { assertParity, parity } from '../parity.js';
import { cleanup, createUser, uniqueName } from './fixtures.js';
import { type Flow, startFlow } from './flow.js';

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 60_000);

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));
const created: string[] = [];

afterAll(async () => {
	// Roles made by the flows (fixtures of cleanup() are made through fixtures.ts only).
	const { appRequest } = await import('../directus-api.js');
	const { data } = await appRequest('directus', 'GET', `/roles?filter=${json({ id: { _in: created } })}&fields=id`);
	if (data.length) await appRequest('directus', 'DELETE', '/roles', { keys: data.map((r: any) => r.id) });
}, 60_000);

/** POST a role (or several) and label the ids; returns them. */
async function make(flow: Flow, body: Record<string, unknown> | Record<string, unknown>[], labels: string[]) {
	const res = await flow.req('POST', '/roles?fields=id,name&sort=name', body);
	const rows = (Array.isArray((res.json as any).data) ? (res.json as any).data : [(res.json as any).data]) as any[];

	rows.forEach((row, i) => {
		flow.name(row.id, labels[i]!);
		created.push(row.id);
	});

	return rows.map((row) => row.id as string);
}

describe('/roles CRUD', () => {
	it('POST one and many, GET, SEARCH (keys ignored), GET /:pk', async () => {
		const prefix = uniqueName('parity-roles');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;

			const [one] = await make(flow, { name: `${name}-a`, icon: 'star' }, ['a']);
			await make(flow, [{ name: `${name}-b` }, { name: `${name}-c`, parent: one }], ['b', 'c']);

			const filter = json({ name: { _starts_with: name } });
			// total_count counts the roles of the other app too (fixtures are made one app after the other).
			await flow.req('GET', `/roles?filter=${filter}&fields=name,parent,icon&sort=name&meta=filter_count`);
			await flow.req('SEARCH', '/roles', {
				keys: [one],
				query: { filter: { name: { _starts_with: name } }, fields: ['name'], sort: ['-name'] },
			});
			await flow.req('GET', `/roles/${one}?fields=id,name,children.name`);
			await flow.req('GET', '/roles/xme');
			await flow.activity();

			return flow.transcript();
		});

		assertSameTranscripts(alias(transcripts, prefix), 'roles create and read');
	});

	it('PATCH by array, keys, query and /:pk; DELETE by array, keys, query and /:pk', async () => {
		const prefix = uniqueName('parity-roles-write');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const ids = await make(
				flow,
				['1', '2', '3', '4'].map((n) => ({ name: `${name}-${n}` })),
				['r1', 'r2', 'r3', 'r4'],
			);

			await flow.req('PATCH', '/roles?fields=name,icon&sort=name', [{ id: ids[0], icon: 'one' }]);
			await flow.req('PATCH', '/roles?fields=name,icon&sort=name', { keys: [ids[1]], data: { icon: 'two' } });
			await flow.req('PATCH', '/roles?fields=name,icon&sort=name', {
				query: { filter: { name: { _eq: `${name}-3` } } },
				data: { icon: 'three' },
			});
			await flow.req('PATCH', `/roles/${ids[3]}?fields=name,icon`, { icon: 'four' });

			await flow.req('DELETE', '/roles', [ids[0]]);
			await flow.req('DELETE', '/roles', { keys: [ids[1]] });
			await flow.req('DELETE', '/roles', { query: { filter: { name: { _eq: `${name}-3` } } } });
			await flow.req('DELETE', `/roles/${ids[3]}`);

			await flow.rows('directus_roles', (q) => q.where('name', 'like', `${name}%`));
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(alias(transcripts, prefix), 'roles update and delete');
	});

	it('validateBatch errors, unknown key, OPTIONS', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);

			await flow.req('PATCH', '/roles', { data: { icon: 'x' } });
			await flow.req('PATCH', '/roles', { keys: ['a'], query: {}, data: {} });
			await flow.req('DELETE', '/roles', {});
			await flow.req('DELETE', '/roles', 'not-json-object');
			await flow.req('SEARCH', '/roles', { query: { limit: 'abc' } });
			await flow.req('GET', '/roles/00000000-0000-4000-8000-000000000000');
			await flow.req('PATCH', '/roles/00000000-0000-4000-8000-000000000000', { icon: 'x' });
			await flow.req('OPTIONS', '/roles');
			await flow.req('OPTIONS', '/roles/abc');
			await flow.req('GET', '/roles/a/b');
			return flow.transcript();
		});

		assertSameTranscripts(transcripts, 'roles errors');
	});
});

describe('US3.1: role cycles', () => {
	it('parent set to a descendant or to itself: 400 with the Directus messages, nothing written', async () => {
		const prefix = uniqueName('parity-roles-cycle');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const [a] = await make(flow, { name: `${name}-a` }, ['a']);
			const [b] = await make(flow, { name: `${name}-b`, parent: a }, ['b']);
			const [c] = await make(flow, { name: `${name}-c`, parent: b }, ['c']);

			await flow.req('PATCH', `/roles/${a}`, { parent: c });
			await flow.req('PATCH', `/roles/${a}`, { parent: a });
			await flow.req('PATCH', '/roles', { keys: [a, b], data: { parent: c } });
			await flow.rows('directus_roles', (q) => q.where('name', 'like', `${name}%`), { orderBy: 'name' });
			return flow.transcript();
		});

		assertSameTranscripts(alias(transcripts, prefix), 'role cycles');

		const messages = (transcripts.backoffice as any[])
			.filter((entry) => entry.response?.status === 400)
			.map((entry) => entry.response.body.errors[0].message);

		expect(messages.slice(0, 2)).toEqual([
			'Invalid payload. A role cannot have a parent that is already a descendant of itself.',
			'Invalid payload. A role cannot be a parent of itself.',
		]);
	});
});

describe('US3.2: deleting a role', () => {
	it('removes its access rows and presets, suspends its users, detaches its children', async () => {
		const prefix = uniqueName('parity-roles-delete');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const [parent] = await make(flow, { name: `${name}-parent` }, ['parent']);
			const [child] = await make(flow, { name: `${name}-child`, parent }, ['child']);

			// Nested writes: a policy (through access), a user and a preset of the role.
			await flow.req('PATCH', `/roles/${parent}?fields=id`, {
				policies: { create: [{ policy: { name: `${name}-policy`, app_access: true } }], update: [], delete: [] },
			});

			const user = await createUser('directus', `${name}-user`, { role: parent });
			flow.name(user.id, 'user');
			flow.name(user.email, 'email');

			const access = await flow.req('GET', `/access?filter=${json({ role: { _eq: parent } })}&fields=id,policy`);
			const row = (access.json as any).data[0];
			flow.name(row.id, 'access');
			flow.name(row.policy, 'policy');

			await flow.req('DELETE', `/roles/${parent}`);

			await flow.rows('directus_roles', (q) => q.whereIn('id', [parent, child]));
			await flow.rows('directus_access', (q) => q.where({ id: row.id }));
			await flow.rows('directus_users', (q) => q.where({ id: user.id }), { columns: ['id', 'role', 'status'] });
			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(alias(transcripts, prefix), 'role delete cascade');
	});
});

describe('nested writes', () => {
	it('POST a role with children, users and policies in the same request', async () => {
		const prefix = uniqueName('parity-roles-nested');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;

			const [id] = await make(
				flow,
				{
					name: `${name}-root`,
					children: [{ name: `${name}-kid` }],
					users: [{ email: `${name}-u@example.com`.toLowerCase() }],
					policies: [{ policy: { name: `${name}-p` } }],
				},
				['root'],
			);

			const read = await flow.req(
				'GET',
				`/roles/${id}?fields=name,children.id,children.name,users.id,users.email,policies.id,policies.policy.id,policies.policy.name`,
			);

			const data = (read.json as any).data;
			flow.name(data.children[0].id, 'kid');
			flow.name(data.users[0].id, 'u');
			flow.name(data.policies[0].id, 'access');
			flow.name(data.policies[0].policy.id, 'p');
			created.push(data.children[0].id);

			await flow.activity();
			return flow.transcript();
		});

		assertSameTranscripts(alias(transcripts, prefix), 'roles nested create');

		// The users and policies made by the flows.
		const { appRequest } = await import('../directus-api.js');
		const filter = json({ email: { _starts_with: prefix } });
		const users = (await appRequest('directus', 'GET', `/users?filter=${filter}&fields=id`)).data;
		if (users.length)
			await appRequest(
				'directus',
				'DELETE',
				'/users',
				users.map((u: any) => u.id),
			);
		const policies = (
			await appRequest('directus', 'GET', `/policies?filter=${json({ name: { _starts_with: prefix } })}&fields=id`)
		).data;
		if (policies.length)
			await appRequest(
				'directus',
				'DELETE',
				'/policies',
				policies.map((p: any) => p.id),
			);
	});
});

describe('/roles/me', () => {
	it('no token at both apps', async () => {
		const result = await parity({ path: '/roles/me' });
		assertParity(result);
	});
});

/** The names of each app's fixture differ by the app suffix; give both the same one. */
function alias<T extends Record<string, unknown>>(transcripts: T, prefix: string): T {
	return Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(JSON.stringify(t).split(`${prefix}-${app}`).join(`${prefix}-<app>`)),
		]),
	) as T;
}
