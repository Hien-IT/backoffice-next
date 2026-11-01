// Spec 028 (contracts/tests.md, research R8): `$FIELD(b)` compares two fields of the same collection and item on the
// six comparison operators. Directus 11.17.4 takes the value as a plain string (T002): 400 on a number field, 500 on a
// timestamp, boolean or uuid field on Postgres (cast error) and 200 with other rows on SQLite, 200 with the literal
// comparison on a string field. Every such
// request is sent to both apps; the status and body differences are accepted as D-203, the Backoffice body is checked
// against the expected items, and the string cases are checked per app. Requests without a `$FIELD(...)` value stay
// identical (FR-009). Permissions with `$FIELD` are refused at Backoffice only (D-204).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, appRequest, appUrl, type AppName } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { assertParity, parity, type ParityResult } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createField,
	createPolicy,
	createUser,
	createUserCollection,
	type TestUser,
} from '../permissions/fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const ORDERS = `parity_field_compare_${run}`;
const CUSTOMERS = `parity_field_compare_customers_${run}`;

const [vendor] = getDbsToTest();
// MySQL and MariaDB compare strings without case by default (utf8mb4 collation), research R10.
const CASE_INSENSITIVE = vendor === 'mysql' || vendor === 'maria';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

const B = 'bbbbbbbb-0000-4000-8000-000000000002';

let token: string;
let adminId: string;
let reader: TestUser; // reads title and total only
let viewer: TestUser; // reads every field of the active rows

beforeAll(async () => {
	token = await adminToken('directus');
	adminId = (await appRequest('directus', 'GET', '/users/me')).data.id;

	await createUserCollection(CUSTOMERS, [
		{ field: 'code', type: 'string' },
		{ field: 'credit', type: 'integer' },
		{ field: 'balance', type: 'integer' },
	]);

	await createUserCollection(ORDERS, [
		{ field: 'title', type: 'string' },
		{ field: 'slug', type: 'string' },
		{ field: 'body', type: 'text' },
		{ field: 'total', type: 'integer' },
		{ field: 'paid_amount', type: 'integer' },
		{ field: 'price', type: 'decimal' },
		// SQLite: Directus adds the special `cast-timestamp` to the field meta, which must exist (400 without it).
		{ field: 'published_at', type: 'timestamp', meta: { interface: 'datetime' } },
		{ field: 'updated_at', type: 'timestamp', meta: { interface: 'datetime' } },
		{ field: 'active', type: 'boolean' },
		{ field: 'featured', type: 'boolean' },
		{ field: 'owner', type: 'uuid' },
		{ field: 'reviewer', type: 'uuid' },
	]);

	await createField(ORDERS, { field: 'customer', type: 'integer', meta: { special: ['m2o'] } });
	await appRequest('directus', 'POST', '/relations', {
		collection: ORDERS,
		field: 'customer',
		related_collection: CUSTOMERS,
	});

	const customers = await appRequest('directus', 'POST', `/items/${CUSTOMERS}`, [
		{ code: 'c1', credit: 10, balance: 5 },
		{ code: 'c2', credit: 5, balance: 10 },
	]);

	const customer = Object.fromEntries((customers.data as { id: number; code: string }[]).map((c) => [c.code, c.id]));

	await appRequest('directus', 'POST', `/items/${ORDERS}`, [
		// prettier-ignore
		{ title: 'Alpha', slug: 'Alpha', body: 'Alpha', total: 100, paid_amount: 60, price: 100, published_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', active: true, featured: true, owner: adminId, reviewer: adminId, customer: customer['c1'] },
		// prettier-ignore
		{ title: 'Beta', slug: 'beta', body: 'Other', total: 50, paid_amount: 60, price: 49.5, published_at: '2026-03-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', active: true, featured: false, owner: adminId, reviewer: B, customer: customer['c2'] },
		// prettier-ignore
		{ title: 'Gamma', slug: 'gamma', body: null, total: 70, paid_amount: null, price: 70, published_at: null, updated_at: '2026-02-01T00:00:00Z', active: null, featured: false, owner: null, reviewer: B, customer: customer['c1'] },
		// prettier-ignore
		{ title: 'Delta', slug: 'Delta', body: 'Delta', total: 60, paid_amount: 60, price: 60, published_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z', active: false, featured: false, owner: B, reviewer: B, customer: null },
	]);

	reader = await createUser('directus', 'cmp-reader');
	const readerPolicy = await createPolicy('directus', 'cmp-reader', {
		app: true,
		permissions: [{ collection: ORDERS, action: 'read', fields: ['id', 'title', 'total'], permissions: {} }],
	});
	await attachPolicy('directus', readerPolicy, { user: reader.id });

	viewer = await createUser('directus', 'cmp-viewer');
	const viewerPolicy = await createPolicy('directus', 'cmp-viewer', {
		app: true,
		permissions: [{ collection: ORDERS, action: 'read', fields: ['*'], permissions: { active: { _eq: true } } }],
	});
	await attachPolicy('directus', viewerPolicy, { user: viewer.id });
}, 300_000);

afterAll(async () => {
	await cleanup();
}, 300_000);

const get = (path: string, auth = token) => ({ path, headers: { authorization: `Bearer ${auth}` } });

const titles = (result: ParityResult) =>
	((result.backoffice.json as { data: { title: string }[] }).data ?? []).map((row) => row.title).sort();

/**
 * What Directus answers to a `$FIELD(b)` value (T002): a number field casts the string in JS (400 on every vendor);
 * a timestamp, boolean or uuid field binds the string, so the database decides: Postgres rejects every cast (500),
 * SQLite compares text (200 with other rows), MySQL rejects the timestamp (500) and compares boolean and uuid (200).
 * Vendors not measured (nightly) are left open: any of the three.
 */
type DirectusAnswer = 'number' | 'timestamp' | 'boolean' | 'uuid';
const DIRECTUS_STATUS: Record<Exclude<DirectusAnswer, 'number'>, Partial<Record<string, number>>> = {
	timestamp: { postgres: 500, postgres10: 500, sqlite3: 200, mysql: 500 },
	boolean: { postgres: 500, postgres10: 500, sqlite3: 200, mysql: 200 },
	uuid: { postgres: 500, postgres10: 500, sqlite3: 200, mysql: 200 },
};

/** A `$FIELD` request: Backoffice compares; a Directus 400/500 is an accepted difference (D-203), a 200 (literal
 * comparison, other rows) is checked per app, as no entry covers two 200 bodies that differ. */
async function compared(path: string, answer: DirectusAnswer | number, auth = token): Promise<ParityResult> {
	const expected = typeof answer === 'number' ? answer : answer === 'number' ? 400 : DIRECTUS_STATUS[answer][vendor];
	const result = await parity(get(path, auth));

	if (expected === 200 || (expected === undefined && result.directus.status === 200)) {
		expect(result.directus.status).toBe(200);
		return result;
	}

	expect(result.differences, JSON.stringify(result.differences)).toEqual([]);
	if (expected === undefined) expect([400, 500]).toContain(result.directus.status);
	else expect(result.directus.status).toBe(expected);
	expect(result.accepted.map((d) => d.id)).toContain('D-203');
	return result;
}

async function filtered(filter: Record<string, unknown>, directusStatus = 400, extra = ''): Promise<string[]> {
	const result = await compared(
		`/items/${ORDERS}?fields=title&limit=-1&filter=${json(filter)}${extra}`,
		directusStatus,
	);
	expect(result.backoffice.status, result.backoffice.text).toBe(200);
	return titles(result);
}

/** One request to one app (string fields: Directus compares with the literal string, both answer 200). `no-store`:
 * both apps share the response cache (feature 005). */
async function at(app: AppName, path: string, init: RequestInit = {}) {
	const res = await fetch(new URL(path, appUrl(app)), {
		...init,
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			'cache-control': 'no-store',
			...init.headers,
		},
	});

	return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

const CASES: [string, Record<string, unknown>, string[], DirectusAnswer][] = [
	['number _gt', { total: { _gt: '$FIELD(paid_amount)' } }, ['Alpha'], 'number'],
	['number _gte', { total: { _gte: '$FIELD(paid_amount)' } }, ['Alpha', 'Delta'], 'number'],
	['number _lt', { total: { _lt: '$FIELD(paid_amount)' } }, ['Beta'], 'number'],
	['number _lte', { total: { _lte: '$FIELD(paid_amount)' } }, ['Beta', 'Delta'], 'number'],
	['number _eq', { total: { _eq: '$FIELD(paid_amount)' } }, ['Delta'], 'number'],
	['number _neq: a null side never matches', { total: { _neq: '$FIELD(paid_amount)' } }, ['Alpha', 'Beta'], 'number'],
	['integer with decimal', { total: { _gt: '$FIELD(price)' } }, ['Beta'], 'number'],
	['integer with decimal _gte', { total: { _gte: '$FIELD(price)' } }, ['Alpha', 'Beta', 'Delta', 'Gamma'], 'number'],
	['timestamp _gt', { updated_at: { _gt: '$FIELD(published_at)' } }, ['Alpha'], 'timestamp'],
	['timestamp _lt', { updated_at: { _lt: '$FIELD(published_at)' } }, ['Beta'], 'timestamp'],
	['timestamp _eq', { updated_at: { _eq: '$FIELD(published_at)' } }, ['Delta'], 'timestamp'],
	['timestamp _neq', { updated_at: { _neq: '$FIELD(published_at)' } }, ['Alpha', 'Beta'], 'timestamp'],
	['boolean _eq', { active: { _eq: '$FIELD(featured)' } }, ['Alpha', 'Delta'], 'boolean'],
	['boolean _neq', { active: { _neq: '$FIELD(featured)' } }, ['Beta'], 'boolean'],
	['uuid _eq', { owner: { _eq: '$FIELD(reviewer)' } }, ['Alpha', 'Delta'], 'uuid'],
	['uuid _neq', { owner: { _neq: '$FIELD(reviewer)' } }, ['Beta'], 'uuid'],
	[
		'm2o: two fields of the related collection',
		{ customer: { credit: { _gt: '$FIELD(balance)' } } },
		['Alpha', 'Gamma'],
		400,
	],
	[
		'_or with a plain condition',
		{ _or: [{ total: { _gt: '$FIELD(paid_amount)' } }, { title: { _eq: 'Gamma' } }] },
		['Alpha', 'Gamma'],
		400,
	],
	[
		'_and with a plain condition',
		{ _and: [{ total: { _gte: '$FIELD(paid_amount)' } }, { active: { _eq: true } }] },
		['Alpha'],
		400,
	],
	['spaces inside the parentheses', { total: { _gt: '$FIELD( paid_amount )' } }, ['Alpha'], 'number'],
	['a field with itself', { total: { _eq: '$FIELD(total)' } }, ['Alpha', 'Beta', 'Delta', 'Gamma'], 'number'],
	// An m2o field is its foreign key column: integer here, so it compares with a number field (clarify Q1).
	['m2o foreign key as a number field', { total: { _eq: '$FIELD(customer)' } }, [], 'number'],
];

describe(`$FIELD(b) on ${vendor}`, () => {
	it.each(CASES)('%s', async (_name, filter, expected, answer) => {
		expect(await filtered(filter, answer)).toEqual(expected);
	});

	it('string fields: Backoffice compares, Directus compares with the literal string (D-203)', async () => {
		const eq = `/items/${ORDERS}?fields=title&limit=-1&filter=${json({ title: { _eq: '$FIELD(slug)' } })}`;
		const neq = `/items/${ORDERS}?fields=title&limit=-1&filter=${json({ title: { _neq: '$FIELD(slug)' } })}`;
		const text = `/items/${ORDERS}?fields=title&limit=-1&filter=${json({ title: { _eq: '$FIELD(body)' } })}`;
		const names = (body: any) => (body.data as { title: string }[]).map((r) => r.title).sort();

		expect(names((await at('backoffice', eq)).body)).toEqual(
			CASE_INSENSITIVE ? ['Alpha', 'Beta', 'Delta', 'Gamma'] : ['Alpha', 'Delta'],
		);
		expect(names((await at('backoffice', neq)).body)).toEqual(CASE_INSENSITIVE ? [] : ['Beta', 'Gamma']);
		expect(names((await at('backoffice', text)).body)).toEqual(['Alpha', 'Delta']);

		const directusEq = await at('directus', eq);
		expect(directusEq.status).toBe(200);
		expect(directusEq.body.data).toEqual([]);
		const directusNeq = await at('directus', neq);
		expect(directusNeq.status).toBe(200);
		expect(names(directusNeq.body)).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
	});

	it('meta filter_count, aggregate, SEARCH, ?export=csv and /utils/export use the same comparison', async () => {
		const filter = { total: { _gt: '$FIELD(paid_amount)' } };

		const counted = await compared(`/items/${ORDERS}?fields=title&meta=filter_count&filter=${json(filter)}`, 400);
		expect((counted.backoffice.json as { meta: { filter_count: number } }).meta.filter_count).toBe(1);

		const aggregated = await compared(`/items/${ORDERS}?aggregate[count]=*&filter=${json(filter)}`, 400);
		expect(Number((aggregated.backoffice.json as { data: { count: string | number }[] }).data[0]!.count)).toBe(1);

		const search = await parity({
			method: 'SEARCH',
			path: `/items/${ORDERS}`,
			headers: { authorization: `Bearer ${token}` },
			body: { query: { fields: ['title'], filter } },
		});
		expect(search.differences).toEqual([]);
		expect(search.directus.status).toBe(400);
		expect(titles(search)).toEqual(['Alpha']);

		const csv = await compared(`/items/${ORDERS}?fields=title&export=csv&filter=${json(filter)}`, 400);
		expect(csv.backoffice.text.trim().split('\n')).toEqual(['"title"', '"Alpha"']);

		// Both answer 204 and run the export as a job (Directus fails inside the job, T002).
		const exported = await parity({
			method: 'POST',
			path: `/utils/export/${ORDERS}`,
			headers: { authorization: `Bearer ${token}` },
			body: { format: 'csv', query: { filter }, file: { title: `parity-${run}` } },
		});
		assertParity(exported);
		expect(exported.backoffice.status).toBe(204);
	});

	it('requests without a $FIELD value stay identical (FR-009)', async () => {
		for (const filter of [
			{ title: { _contains: '$FIELD(slug)' } },
			{ title: { _eq: '$field(slug)' } },
			{ title: { _eq: '$FIELD(slug' } },
			{ title: { _in: ['$FIELD(slug)'] } },
			{ title: { _gt: '$FIELD(slug)' } },
			{ total: { _null: '$FIELD(x)' } },
			{ published_at: { _lt: '$NOW(-1 day)' } },
			{ owner: { _eq: '$CURRENT_USER' } },
			{ total: { _gt: 60 } },
		]) {
			const result = await parity(get(`/items/${ORDERS}?fields=title&sort=title&limit=-1&filter=${json(filter)}`));
			assertParity(result);
			// D-01 (x-powered-by) only.
			expect(result.accepted.map((d) => d.id).filter((id) => id !== 'D-01')).toEqual([]);
		}
	});

	it('an unknown field b is 403 like an unknown filter key, for the admin too (FR-006)', async () => {
		const result = await compared(`/items/${ORDERS}?filter=${json({ total: { _eq: '$FIELD(nope)' } })}`, 400);
		expect(result.backoffice.status, result.backoffice.text).toBe(403);
		expect((result.backoffice.json as any).errors[0].extensions.code).toBe('FORBIDDEN');
		expect((result.backoffice.json as any).errors[0].message).toContain('field "nope"');
	});

	it('another type group, an alias, a relation, an empty name and a function key are 400 at Backoffice', async () => {
		// Directus casts the string to the type of field a: 400 on a number field, 500 on a timestamp field (T002).
		for (const [filter, message, directusStatus] of [
			[{ total: { _gt: '$FIELD(title)' } }, 'must be a number field like "total" (got string)', 400],
			[{ published_at: { _gt: '$FIELD(total)' } }, 'must be a timestamp field', 'timestamp'],
			[{ total: { _eq: '$FIELD(customer.credit)' } }, 'a field of the same collection is expected', 400],
			[{ total: { _eq: '$FIELD()' } }, 'a field of the same collection is expected', 400],
			[{ 'year(published_at)': { _eq: '$FIELD(total)' } }, 'only allowed on a plain field', 400],
		] as [Record<string, unknown>, string, DirectusAnswer | number][]) {
			const result = await compared(`/items/${ORDERS}?filter=${json(filter)}`, directusStatus);
			expect(result.backoffice.status, result.backoffice.text).toBe(400);
			expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_QUERY');
			expect((result.backoffice.json as any).errors[0].message).toContain(message);
		}
	});

	it('the user needs read access to field b as to a filter key (FR-006); the row filter still applies', async () => {
		const forbidden = await parity(
			get(`/items/${ORDERS}?fields=title&filter=${json({ total: { _gt: '$FIELD(paid_amount)' } })}`, reader.token),
		);
		assertParity(forbidden);
		expect(forbidden.backoffice.status).toBe(403);

		const unknown = await parity(
			get(`/items/${ORDERS}?fields=title&filter=${json({ total: { _gt: '$FIELD(nope)' } })}`, reader.token),
		);
		assertParity(unknown);
		expect(unknown.backoffice.status).toBe(403);

		const allowed = await compared(
			`/items/${ORDERS}?fields=title&limit=-1&filter=${json({ total: { _gte: '$FIELD(paid_amount)' } })}`,
			400,
			viewer.token,
		);
		expect(titles(allowed)).toEqual(['Alpha']);
	});

	it('a permission with $FIELD is refused at Backoffice, saved at Directus (D-204); /fields is not checked', async () => {
		const policy = await createPolicy('directus', 'cmp-d204');
		const headers = { authorization: `Bearer ${token}` };
		const row = { policy, collection: ORDERS, action: 'read', fields: ['*'] };

		for (const key of ['permissions', 'validation'] as const) {
			const created = await parity({
				method: 'POST',
				path: '/permissions',
				headers,
				body: { ...row, [key]: { total: { _gt: '$FIELD(paid_amount)' } } },
			});
			expect(created.differences, JSON.stringify(created.differences)).toEqual([]);
			// The D-185 entry (same endpoints, same INVALID_PAYLOAD condition) accepts it; D-204 is a `doc` entry.
			expect(created.accepted.map((d) => d.id)).toContain('D-185');
			expect(created.backoffice.status).toBe(400);
			expect((created.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_PAYLOAD');
			expect(created.directus.status).toBe(200);
			await appRequest('directus', 'DELETE', `/permissions/${(created.directus.json as any).data.id}`);
		}

		const plain = await appRequest('directus', 'POST', '/permissions', row);
		const updated = await parity({
			method: 'PATCH',
			path: `/permissions/${plain.data.id}`,
			headers,
			body: { permissions: { _and: [{ updated_at: { _gte: '$FIELD(published_at)' } }] } },
		});
		expect(updated.differences).toEqual([]);
		expect(updated.backoffice.status).toBe(400);
		expect(updated.directus.status).toBe(200);
		await appRequest('directus', 'DELETE', `/permissions/${plain.data.id}`);

		// D-189.6: /backoffice/permissions exists at Backoffice only.
		const backoffice = await at('backoffice', '/backoffice/permissions', {
			method: 'POST',
			body: JSON.stringify({
				policy,
				collection: ORDERS,
				action: 'export',
				fields: ['*'],
				permissions: { total: { _lt: '$FIELD(paid_amount)' } },
			}),
		});
		expect(backoffice.status).toBe(400);
		expect(backoffice.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

		// Field validation runs in JS at both apps (FR-011): saved as is.
		const field = {
			field: `note_${run}`,
			type: 'string',
			meta: { validation: { [`note_${run}`]: { _neq: '$FIELD(title)' } } },
		};
		const saved = await at('backoffice', `/fields/${ORDERS}`, { method: 'POST', body: JSON.stringify(field) });
		expect(saved.status).toBe(200);
	});
});
