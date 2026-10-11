// Feature 004, US2.4, US2.5 and FR-017, FR-030 to FR-037, FR-005: write rules through the five endpoints (presets in
// policy order, validation of every policy, fields not allowed, nested writes checked per level, keys that do not
// exist, order of the errors, atomic batches). Each app runs the same flow with its own fixture (scenario()) and the
// rows written are compared.
import { afterAll, describe, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { appRequest } from '../directus-api.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createRoleTree,
	createUser,
	type Permission,
	uniqueName,
} from './fixtures.js';
import { startFlow } from './flow.js';

afterAll(async () => {
	// Rows the flows made (the fixtures of fixtures.ts are removed by cleanup()).
	const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

	for (const [path, field] of [
		['/users', 'email'],
		['/policies', 'name'],
		['/roles', 'name'],
	] as const) {
		const filter = json({
			_or: ['parity-write', 'nomatch-parity-write', 'bad-parity-write', 'parity-x-'].map((p) => ({
				[field]: { _starts_with: p },
			})),
		});
		const { data } = await appRequest('directus', 'GET', `${path}?filter=${filter}&fields=id&limit=-1`);
		if (data.length) await appRequest('directus', 'DELETE', path, { keys: data.map((r: any) => r.id) });
	}

	await cleanup();
	await closeHostDb();
}, 60_000);

/** The names of each app's fixture differ by the app suffix; give both the same one. */
function same<T extends Record<string, unknown>>(transcripts: T, prefix: string): T {
	return Object.fromEntries(
		Object.entries(transcripts).map(([app, t]) => [
			app,
			JSON.parse(JSON.stringify(t).split(`${prefix}-${app}`).join(`${prefix}-<app>`)),
		]),
	) as T;
}

/** A user under a role tree: `parent` policies on the root role, `child` policies on the leaf (policy order). */
async function userWith(name: string, parent: Permission[], child: Permission[] = []) {
	const tree = await createRoleTree('directus', name);
	if (parent.length)
		await attachPolicy('directus', await createPolicy('directus', `${name}-parent`, { permissions: parent }), {
			role: tree.root,
		});
	if (child.length)
		await attachPolicy('directus', await createPolicy('directus', `${name}-child`, { permissions: child }), {
			role: tree.leaf,
		});
	const user = await createUser('directus', name, { role: tree.leaf });
	return { user, tree, headers: { authorization: `Bearer ${user.token}` } };
}

const ROLE_COLUMNS = ['name', 'icon', 'description', 'parent'];

describe('US2.4: presets and validation of several policies', () => {
	it('the later policy preset wins, the payload wins over presets, every validation must pass', async () => {
		const prefix = uniqueName('parity-write-presets');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const { headers } = await userWith(
				name,
				[
					{
						collection: 'directus_roles',
						action: 'create',
						fields: ['*'],
						permissions: {},
						presets: { icon: 'draft', description: 'parent' },
						validation: { name: { _starts_with: 'parity' } },
					},
				],
				[
					{
						collection: 'directus_roles',
						action: 'create',
						fields: ['*'],
						permissions: {},
						presets: { icon: 'review' },
						validation: { name: { _contains: 'write' } },
					},
				],
			);

			await flow.req('POST', '/roles?fields=name,icon,description', { name: `${name}-preset` }, headers);
			await flow.req(
				'POST',
				'/roles?fields=name,icon,description',
				{ name: `${name}-payload`, icon: 'published' },
				headers,
			);
			// Fails the parent validation (starts with parity), then the child one (contains write), then a batch item.
			const other = `parity-x-${ctx.app}-${prefix.slice(-8)}`;
			await flow.req('POST', '/roles?fields=name', { name: `nomatch-${name}` }, headers);
			await flow.req('POST', '/roles?fields=name', { name: other }, headers);
			await flow.req('POST', '/roles?fields=name', [{ name: `${name}-ok` }, { name: `bad-${name}` }], headers);
			const names = ['preset', 'payload', 'ok']
				.map((n) => `${name}-${n}`)
				.concat([`nomatch-${name}`, other, `bad-${name}`]);
			flow.name(other, 'other');
			await flow.rows('directus_roles', (q) => q.whereIn('name', names), {
				orderBy: 'name',
				columns: ROLE_COLUMNS,
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'presets and validation');
	});
});

describe('US2.5, FR-031, FR-036: update with a filter on $CURRENT_USER.<relation>', () => {
	it('items outside the filter, fields not allowed and missing keys are refused; the DB is unchanged', async () => {
		const prefix = uniqueName('parity-write-update');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const { headers, tree, user } = await userWith(name, [
				{ collection: 'directus_roles', action: 'read', fields: ['*'], permissions: {} },
				{
					collection: 'directus_roles',
					action: 'update',
					fields: ['icon'],
					permissions: { parent: { _eq: '$CURRENT_USER.role.parent' } },
				},
			]);
			flow.name(user.id, 'user');
			flow.name(tree.root, 'root');
			flow.name(tree.middle, 'middle');
			flow.name(tree.leaf, 'leaf');

			await flow.req('PATCH', `/roles/${tree.leaf}?fields=icon`, { icon: 'allowed' }, headers);
			await flow.req('PATCH', `/roles/${tree.middle}?fields=icon`, { icon: 'outside' }, headers);
			await flow.req('PATCH', `/roles/${tree.leaf}`, { name: 'not-allowed-field' }, headers);
			await flow.req('PATCH', '/roles/00000000-0000-4000-8000-000000000000', { icon: 'missing' }, headers);
			await flow.req('PATCH', '/roles', { keys: [tree.leaf, tree.middle], data: { icon: 'batch' } }, headers);
			await flow.req('DELETE', `/roles/${tree.leaf}`, undefined, headers);
			await flow.req('DELETE', '/roles/00000000-0000-4000-8000-000000000000', undefined, headers);
			await flow.req('PATCH', '/roles/00000000-0000-4000-8000-000000000000', { icon: 'admin-missing' });
			await flow.req('DELETE', '/roles/00000000-0000-4000-8000-000000000000');
			// Ordered by name (leaf, middle, root); the names end with a random suffix of the fixture, not compared.
			await flow.rows('directus_roles', (q) => q.whereIn('id', [tree.root, tree.middle, tree.leaf]), {
				orderBy: 'name',
				columns: ['icon', 'description', 'parent'],
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'update rules');
	});
});

describe('FR-030, FR-037: nested writes are checked at each level with the service of that level', () => {
	it('a role with nested users and policies: refused where the nested collection is not allowed', async () => {
		const prefix = uniqueName('parity-write-nested');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const { headers } = await userWith(name, [
				{ collection: 'directus_roles', action: 'create', fields: ['*'], permissions: {} },
				{ collection: 'directus_roles', action: 'read', fields: ['*'], permissions: {} },
				{ collection: 'directus_users', action: 'create', fields: ['email', 'role'], permissions: {} },
			]);

			await flow.req(
				'POST',
				'/roles?fields=name,users.email',
				{ name: `${name}-with-users`, users: [{ email: `${name}-n1@example.com` }] },
				headers,
			);
			await flow.req(
				'POST',
				'/roles?fields=name',
				{ name: `${name}-with-user-field`, users: [{ email: `${name}-n2@example.com`, first_name: 'x' }] },
				headers,
			);
			await flow.req(
				'POST',
				'/roles?fields=name',
				{ name: `${name}-with-policies`, policies: [{ policy: { name: `${name}-p` } }] },
				headers,
			);
			await flow.rows('directus_roles', (q) => q.where('name', 'like', `${name}-with%`), {
				orderBy: 'name',
				columns: ROLE_COLUMNS,
			});
			await flow.rows('directus_users', (q) => q.where('email', 'like', `${name}-n%`), {
				orderBy: 'email',
				columns: ['email', 'first_name'],
			});
			await flow.rows('directus_policies', (q) => q.where({ name: `${name}-p` }), { columns: ['name'] });
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'nested writes');
	});
});

describe('FR-005, FR-033: order of the errors, atomic batches', () => {
	it('permission errors before the checks of the service; a batch with one bad item writes nothing', async () => {
		const prefix = uniqueName('parity-write-order');

		const transcripts = await scenario(urls(), async (ctx) => {
			const flow = await startFlow(ctx);
			const name = `${prefix}-${ctx.app}`;
			const { headers } = await userWith(name, [
				{ collection: 'directus_users', action: 'create', fields: ['email', 'password'], permissions: {} },
			]);

			// Not allowed field and an invalid email: the permission error comes first.
			await flow.req('POST', '/users', { email: 'not-an-email', title: 'x' }, headers);
			// Allowed fields, invalid email: the service check.
			await flow.req('POST', '/users', { email: 'not-an-email' }, headers);
			// A batch whose second item fails: nothing is written.
			await flow.req('POST', '/users', [{ email: `${name}-1@example.com` }, { email: 'not-an-email' }], headers);
			await flow.req(
				'POST',
				'/users',
				[{ email: `${name}-2@example.com` }, { email: `${name}-2@example.com` }],
				headers,
			);
			await flow.rows('directus_users', (q) => q.whereIn('email', [`${name}-1@example.com`, `${name}-2@example.com`]), {
				orderBy: 'email',
				columns: ['email'],
			});
			return flow.transcript();
		});

		assertSameTranscripts(same(transcripts, prefix), 'error order');
	});
});
