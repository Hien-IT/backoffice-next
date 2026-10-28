// Spec 025 (contracts/tests.md, research R11): the import and export permissions of backoffice_permissions. Directus
// 11.17.4 ignores the table: without a row Directus exports and imports where Backoffice refuses (D-189.1); with a full
// row both apps answer the same (FR-035); Use custom is checked at Backoffice on its own; /permissions/me carries
// import and export at Backoffice only (D-189); the table never troubles Directus (US6). Rows are written through
// /backoffice/permissions (D-189.6). This file runs alone (fileParallelism: false).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, appRequest, appUrl, type AppName } from '../directus-api.js';
import { multipart } from '../files/helpers.js';
import { gqlRequest } from '../graphql/helpers.js';
import { assertParity, capture, parity, type Captured, type ParityRequest } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createShare,
	createUser,
	createUserCollection,
	type TestUser,
} from './fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const A = `parity_bo_perm_${run}`;

let admin: string;
let reader: TestUser;
let readerJwt: string;
let shareToken: string;
let readerPolicy: string;
let secondPolicy: string;
let publicPolicy: string;
const granted: number[] = [];

const forbidden = `You don't have permission to access collection "${A}" or it does not exist. Queried in root.`;
const auth = (token: string | null): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {});

async function login(path: string, body: Record<string, unknown>): Promise<string> {
	const res = await fetch(new URL(path, appUrl('directus')), {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

	return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

async function clearCaches() {
	await appRequest('directus', 'POST', '/utils/cache/clear');
	await appRequest('backoffice', 'POST', '/utils/cache/clear');
}

/** A row of backoffice_permissions on A, written at Backoffice (D-189.6). */
async function grant(policy: string, action: 'import' | 'export', extra: Record<string, unknown> = {}) {
	const res = await appRequest('backoffice', 'POST', '/backoffice/permissions', {
		policy,
		collection: A,
		action,
		...extra,
	});
	granted.push(res.data.id);
	await clearCaches();
	return res.data.id as number;
}

async function revokeAll() {
	if (granted.length) await appRequest('backoffice', 'DELETE', '/backoffice/permissions', granted.splice(0));
	await clearCaches();
}

const titles = async () =>
	((await appRequest('directus', 'GET', `/items/${A}?fields=title&sort=id&limit=-1`)).data as { title: string }[]).map(
		(row) => row.title,
	);

/** One request to one app, for requests that write or differ by design. */
const at = (app: AppName, req: ParityRequest): Promise<Captured> =>
	capture(appUrl(app), { ...req, headers: { 'cache-control': 'no-store', ...req.headers } });

/** Both apps: Directus answers, Backoffice refuses with the collection error; only D-189.1 differs. */
async function blocked(req: ParityRequest, message = forbidden) {
	const result = await parity(req);
	expect(result.differences, JSON.stringify(result.differences)).toEqual([]);
	expect(result.directus.status, result.directus.text).toBe(200);
	expect(result.backoffice.status, result.backoffice.text).toBe(403);
	expect((result.backoffice.json as any).errors[0]).toMatchObject({ message, extensions: { code: 'FORBIDDEN' } });
	expect(result.accepted.map((d) => d.id)).toContain('D-189.1');
}

const csvFile = (text: string) =>
	multipart([{ name: 'file', data: Buffer.from(text), filename: 'rows.csv', contentType: 'text/csv' }]);

const jsonFile = (rows: unknown[]) =>
	multipart([
		{ name: 'file', data: Buffer.from(JSON.stringify(rows)), filename: 'rows.json', contentType: 'application/json' },
	]);

beforeAll(async () => {
	admin = await adminToken('directus');

	await createUserCollection(A, [
		{ field: 'title', type: 'string' },
		{ field: 'status', type: 'string' },
		{ field: 'body', type: 'text' },
	]);

	const full = (collection: string, actions: ('read' | 'create' | 'update' | 'delete')[]) =>
		actions.map((action) => ({ collection, action, fields: ['*'], permissions: {} }));

	readerPolicy = await createPolicy('directus', `bo-perm-${run}`, {
		permissions: [...full(A, ['read', 'create', 'update', 'delete']), ...full('directus_users', ['read'])],
	});
	secondPolicy = await createPolicy('directus', `bo-perm-2-${run}`);

	reader = await createUser('directus', `bo-perm-${run}`);
	await attachPolicy('directus', readerPolicy, { user: reader.id });
	await attachPolicy('directus', secondPolicy, { user: reader.id });
	readerJwt = await login('/auth/login', { email: reader.email, password: reader.password });

	publicPolicy = await createPolicy('directus', `bo-perm-public-${run}`, { permissions: full(A, ['read']) });
	await attachPolicy('directus', publicPolicy, { role: null, user: null });

	const rows = await appRequest('directus', 'POST', `/items/${A}`, [
		{ title: 'alpha', status: 'published', body: 'a' },
		{ title: 'beta', status: 'draft', body: 'b' },
	]);

	shareToken = await login('/shares/auth', { share: await createShare(A, rows.data[0].id), mode: 'json' });
	await clearCaches();
}, 300_000);

afterAll(async () => {
	await revokeAll().catch(() => undefined);
	await appRequest('directus', 'DELETE', `/items/${A}`, { query: { limit: -1 } });
	await cleanup();
	await clearCaches();
}, 300_000);

describe('/backoffice/permissions (D-189.5, D-189.6)', () => {
	it('CRUD at Backoffice with activity; Directus has no such route', async () => {
		const id = await grant(secondPolicy, 'export', { fields: ['id'], options: { formats: ['csv'] } });

		const read = await at('backoffice', { path: `/backoffice/permissions/${id}`, headers: auth(admin) });
		expect(read.status, read.text).toBe(200);
		expect((read.json as any).data).toMatchObject({
			policy: secondPolicy,
			collection: A,
			action: 'export',
			fields: ['id'],
		});

		const patched = await at('backoffice', {
			method: 'PATCH',
			path: `/backoffice/permissions/${id}`,
			headers: auth(admin),
			body: { options: { formats: ['json'] } },
		});
		expect((patched.json as any).data.options).toEqual({ formats: ['json'] });

		const activity = await appRequest(
			'directus',
			'GET',
			`/activity?filter[collection][_eq]=backoffice_permissions&filter[item][_eq]=${id}&fields=action`,
		);
		expect(activity.data.map((a: { action: string }) => a.action).sort()).toEqual(['create', 'update']);

		const directus = await at('directus', { path: '/backoffice/permissions', headers: auth(admin) });
		expect(directus.status).toBe(404);

		await revokeAll();
	});

	it('/items/backoffice_permissions: Backoffice refuses like a system collection, Directus admin reads the table', async () => {
		expect((await at('backoffice', { path: '/items/backoffice_permissions', headers: auth(admin) })).status).toBe(403);
		expect((await at('directus', { path: '/items/backoffice_permissions', headers: auth(admin) })).status).toBe(200);
	});
});

describe('no import or export permission (D-189.1)', () => {
	const callers: [string, () => string | null][] = [
		['user (JWT)', () => readerJwt],
		['user (static token)', () => reader.token],
		['public', () => null],
		['share', () => shareToken],
	];

	it.each(callers)('%s: ?export= is refused at Backoffice', async (_name, token) => {
		await blocked({ path: `/items/${A}?export=csv`, headers: auth(token()) });
	});

	it('SEARCH with export in the body query, on items and on /users (CHK015)', async () => {
		await blocked({
			method: 'SEARCH',
			path: `/items/${A}`,
			headers: auth(readerJwt),
			body: { query: { export: 'csv' } },
		});
		await blocked(
			{ method: 'SEARCH', path: '/users', headers: auth(readerJwt), body: { query: { export: 'csv' } } },
			`You don't have permission to access collection "directus_users" or it does not exist. Queried in root.`,
		);
		await blocked(
			{ path: '/users?export=csv', headers: auth(readerJwt) },
			`You don't have permission to access collection "directus_users" or it does not exist. Queried in root.`,
		);
	});

	it('POST /utils/export and /utils/import: refused, no file, no row (Backoffice)', async () => {
		const before = await titles();
		const title = `parity-bo-perm-${run}`;

		const exported = await at('backoffice', {
			method: 'POST',
			path: `/utils/export/${A}`,
			headers: auth(readerJwt),
			body: { query: {}, format: 'csv', file: { title } },
		});
		expect(exported.status, exported.text).toBe(403);
		expect((exported.json as any).errors[0].message).toBe(forbidden);

		const { body, headers } = csvFile('title\nimported\n');
		const imported = await at('backoffice', {
			method: 'POST',
			path: `/utils/import/${A}`,
			headers: { ...headers, ...auth(readerJwt) },
			body,
		});
		expect(imported.status, imported.text).toBe(403);

		await new Promise((resolve) => setTimeout(resolve, 2000));
		expect((await appRequest('directus', 'GET', `/files?filter[title][_eq]=${title}&fields=id`)).data).toEqual([]);
		expect(await titles()).toEqual(before);
	});

	it('import into a system collection keeps the rule of Directus (both apps refuse alike, FR-007)', async () => {
		const { body, headers } = jsonFile([{ name: 'x' }]);
		assertParity(
			await parity({
				method: 'POST',
				path: '/utils/import/directus_dashboards',
				headers: { ...headers, ...auth(readerJwt) },
				body,
			}),
		);
	});

	it('the toggle of 024 answers first, even for an admin with a row (FR-009)', async () => {
		await grant(readerPolicy, 'export');
		await appRequest('directus', 'PATCH', `/collections/${A}`, { meta: { bo_show_export: false } });
		await clearCaches();

		try {
			const res = await at('backoffice', { path: `/items/${A}?export=csv`, headers: auth(admin) });
			expect(res.status).toBe(403);
		} finally {
			await appRequest('directus', 'PATCH', `/collections/${A}`, { meta: { bo_show_export: true } });
			await revokeAll();
		}
	});
});

describe('with a full row both apps answer the same (FR-035)', () => {
	beforeAll(async () => {
		await grant(readerPolicy, 'export');
		await grant(readerPolicy, 'import');
		await grant(publicPolicy, 'export');
	});

	afterAll(() => revokeAll());

	it.each(['csv', 'json', 'csv_utf8', 'xml', 'yaml'])('?export=%s', async (format) => {
		assertParity(
			await parity({ path: `/items/${A}?fields=title,status&sort=id&export=${format}`, headers: auth(readerJwt) }),
		);
	});

	it('SEARCH with export, the public role, an admin without any row', async () => {
		assertParity(
			await parity({
				method: 'SEARCH',
				path: `/items/${A}`,
				headers: auth(readerJwt),
				body: { query: { fields: ['title'], sort: ['id'], export: 'json' } },
			}),
		);
		assertParity(await parity({ path: `/items/${A}?fields=title&sort=id&export=csv` }));
		assertParity(await parity({ path: `/users?fields=id&sort=id&export=json`, headers: auth(admin) }));
	});

	it('a row on the second policy of the user is enough (FR-011)', async () => {
		await revokeAll();
		await grant(secondPolicy, 'export');
		assertParity(await parity({ path: `/items/${A}?fields=title&sort=id&export=json`, headers: auth(readerJwt) }));
	});

	it('import: 200 at both apps, the rows written', async () => {
		await grant(readerPolicy, 'import');
		const before = (await titles()).length;

		for (const app of ['backoffice', 'directus'] as const) {
			const { body, headers } = csvFile(`title,status\nimported-${app},draft\n`);
			const res = await at(app, {
				method: 'POST',
				path: `/utils/import/${A}`,
				headers: { ...headers, ...auth(readerJwt) },
				body,
			});
			expect(res.status, `${app} ${res.text}`).toBe(200);
		}

		expect((await titles()).length).toBe(before + 2);
	});
});

describe('Use custom at Backoffice (FR-015, FR-016, FR-017)', () => {
	beforeAll(async () => {
		await revokeAll();
		await grant(readerPolicy, 'export', {
			permissions: { status: { _eq: 'published' } },
			fields: ['id', 'title'],
			options: { formats: ['csv'] },
		});
		await grant(readerPolicy, 'import', {
			permissions: { status: { _eq: 'draft' } },
			fields: ['title', 'status'],
			options: { formats: ['csv'] },
		});
	});

	afterAll(() => revokeAll());

	it('export: only rows of the filter, only the allowed fields, only the allowed format', async () => {
		const csv = await at('backoffice', { path: `/items/${A}?export=csv&sort=id`, headers: auth(readerJwt) });
		expect(csv.status, csv.text).toBe(200);
		expect(csv.text.split('\n')[0]).toBe('"id","title"');
		expect(csv.text).toContain('alpha');
		expect(csv.text).not.toContain('beta');

		const json = await at('backoffice', { path: `/items/${A}?export=json`, headers: auth(readerJwt) });
		expect(json.status).toBe(403);

		const outside = await at('backoffice', { path: `/items/${A}?export=csv&fields=id,body`, headers: auth(readerJwt) });
		expect(outside.status).toBe(403);
		expect((outside.json as any).errors[0].message).toContain('field "body"');

		const file = await at('backoffice', {
			method: 'POST',
			path: `/utils/export/${A}`,
			headers: auth(readerJwt),
			body: { query: {}, format: 'json' },
		});
		expect(file.status).toBe(403);
	});

	it('import: a row outside the filter, a column outside the fields or a JSON file refuse the whole file', async () => {
		const before = await titles();

		for (const [name, { body, headers }] of [
			['row outside the filter', csvFile('title,status\nok,draft\nno,published\n')],
			['column outside the fields', csvFile('title,status,body\nok,draft,x\n')],
			['format', jsonFile([{ title: 'ok', status: 'draft' }])],
		] as const) {
			const res = await at('backoffice', {
				method: 'POST',
				path: `/utils/import/${A}`,
				headers: { ...headers, ...auth(readerJwt) },
				body,
			});
			expect(res.status, `${name}: ${res.text}`).toBe(403);
		}

		expect(await titles()).toEqual(before);

		const { body, headers } = csvFile('title,status\nallowed,draft\n');
		const ok = await at('backoffice', {
			method: 'POST',
			path: `/utils/import/${A}`,
			headers: { ...headers, ...auth(readerJwt) },
			body,
		});
		expect(ok.status, ok.text).toBe(200);
		expect(await titles()).toContain('allowed');
	});
});

// FR-011 (revised 2026-10-28): each policy's filter goes with its own fields and formats, as the read rules of DR do.
describe('Use custom on two policies at Backoffice (FR-011)', () => {
	beforeAll(async () => {
		await revokeAll();
		await grant(readerPolicy, 'export', {
			permissions: { status: { _eq: 'published' } },
			fields: ['id', 'title'],
			options: { formats: ['csv'] },
		});
		await grant(secondPolicy, 'export', {
			permissions: { status: { _eq: 'draft' } },
			fields: ['id', 'title', 'body'],
			options: { formats: ['csv', 'json'] },
		});
		await grant(readerPolicy, 'import', { permissions: { status: { _eq: 'draft' } }, fields: ['title', 'status'] });
		await grant(secondPolicy, 'import', { fields: ['title', 'body'] });
	});

	afterAll(() => revokeAll());

	it('export: a field shows only on the rows of the policy that allows it; a format only opens its own rows', async () => {
		const csv = await at('backoffice', { path: `/items/${A}?export=csv&sort=id`, headers: auth(readerJwt) });
		expect(csv.status, csv.text).toBe(200);
		const lines = csv.text.split('\n');
		expect(lines[0]).toBe('"id","title","body"');
		// alpha is published: the first policy exports it without body; beta is a draft: the second, with body.
		expect(lines.find((line) => line.includes('"alpha"'))).not.toContain('"a"');
		expect(lines.find((line) => line.includes('"beta"'))).toContain('"b"');

		const json = await at('backoffice', { path: `/items/${A}?export=json&sort=id`, headers: auth(readerJwt) });
		expect(json.status, json.text).toBe(200);
		const rows = json.json as { title: string; body: string | null }[];
		expect(rows.map((row) => row.title)).not.toContain('alpha');
		expect(rows.find((row) => row.title === 'beta')).toMatchObject({ body: 'b' });
	});

	it('import: each row fits one policy whole; the columns of one with the filter of the other refuse the file', async () => {
		const before = await titles();
		const send = (text: string) => {
			const { body, headers } = csvFile(text);
			return at('backoffice', {
				method: 'POST',
				path: `/utils/import/${A}`,
				headers: { ...headers, ...auth(readerJwt) },
				body,
			});
		};

		const mixed = await send('title,status,body\nmixed,draft,x\n');
		expect(mixed.status, mixed.text).toBe(403);
		expect(await titles()).toEqual(before);

		const second = await send('title,body\nsecond,x\n');
		expect(second.status, second.text).toBe(200);
		expect(await titles()).toContain('second');
	});
});

describe('/permissions/me and permissions_me (D-189)', () => {
	beforeAll(async () => {
		await revokeAll();
		await grant(readerPolicy, 'export', { options: { formats: ['csv'] } });
	});

	afterAll(() => revokeAll());

	it('the user: only the import and export keys differ', async () => {
		const result = await parity({ path: '/permissions/me', headers: auth(readerJwt) });
		expect(result.differences, JSON.stringify(result.differences)).toEqual([]);
		expect((result.backoffice.json as any).data[A]).toMatchObject({
			export: { access: 'full', formats: ['csv'] },
			import: { access: 'none' },
		});
		expect(result.accepted.map((d) => d.id)).toContain('D-189');
	});

	it('the admin and GraphQL system', async () => {
		const me = await parity({ path: '/permissions/me', headers: auth(admin) });
		expect(me.differences, JSON.stringify(me.differences)).toEqual([]);

		// permissions_me is in the system schema of callers who may read directus_permissions (both apps answer 400 else).
		const graphql = await parity(gqlRequest('system', '{ permissions_me }', { token: admin }));
		expect(graphql.differences, JSON.stringify(graphql.differences)).toEqual([]);
		expect((graphql.backoffice.json as any).data.permissions_me[A].export.access).toBe('full');
	});
});

describe('Directus on the same database (US6, SC-003)', () => {
	it('snapshot and diff leave the table alone; /permissions/me of Directus answers', async () => {
		const id = await grant(secondPolicy, 'export');

		const snapshot = await appRequest('directus', 'GET', '/schema/snapshot');
		expect(JSON.stringify(snapshot.data)).not.toContain('backoffice_permissions');

		const diff = await capture(appUrl('directus'), {
			method: 'POST',
			path: '/schema/diff',
			headers: auth(admin),
			body: snapshot.data,
		});
		expect(diff.status, diff.text).toBe(204);

		const me = await at('directus', { path: '/permissions/me', headers: auth(readerJwt) });
		expect(me.status, me.text).toBe(200);
		expect((me.json as any).data[A].export).toBeUndefined();

		await appRequest('backoffice', 'DELETE', `/backoffice/permissions/${id}`);
		granted.splice(granted.indexOf(id), 1);
	});

	it('a policy deleted at Directus leaves its rows; Backoffice still answers (FR-012)', async () => {
		const extra = await createPolicy('directus', `bo-perm-3-${run}`);
		const id = await grant(extra, 'export');

		await appRequest('directus', 'DELETE', `/policies/${extra}`);
		await clearCaches();

		const rows = await appRequest('backoffice', 'GET', `/backoffice/permissions?filter[id][_eq]=${id}`);
		expect(rows.data).toHaveLength(1);
		expect((await at('backoffice', { path: '/server/health' })).status).toBe(200);
		expect((await at('backoffice', { path: `/items/${A}?export=csv`, headers: auth(readerJwt) })).status).toBe(403);
	});

	it('a policy deleted at Backoffice takes its rows with it (FR-021)', async () => {
		const extra = await createPolicy('directus', `bo-perm-4-${run}`);
		const id = await grant(extra, 'export');

		await appRequest('backoffice', 'DELETE', `/policies/${extra}`);
		granted.splice(granted.indexOf(id), 1);

		const rows = await appRequest('backoffice', 'GET', `/backoffice/permissions?filter[id][_eq]=${id}`);
		expect(rows.data).toEqual([]);
	});
});
