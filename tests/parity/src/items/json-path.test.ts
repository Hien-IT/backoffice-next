// Spec 023 (contracts/tests.md, research R10): filters on a path inside a json field, json(field, path[, type]).
// Directus 11.17.4 answers 403 FORBIDDEN to these keys (its path check reads "field, path, type" as a field name, T002),
// Backoffice filters: every json path request is compared at both apps with the difference accepted as D-184, and the
// Backoffice body is checked against the expected items. Requests without a json path stay identical (FR-012).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
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
} from '../permissions/fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const PAYMENTS = `parity_json_path_${run}`;
const ORDERS = `parity_json_path_orders_${run}`;

const [vendor] = getDbsToTest();
const POSTGRES = vendor === 'postgres' || vendor === 'postgres10';
const SUPPORTED = POSTGRES || vendor === 'sqlite3';

const json = (value: unknown) => encodeURIComponent(JSON.stringify(value));

let token: string;

const ORDER_ROWS = [
	{ code: 'o1', details: { total: 150, items: [{ sku: 'A' }] } },
	{ code: 'o2', details: { total: 50 } },
];

// title → transaction_data, labels, status, order code
const PAYMENT_ROWS: [string, unknown, unknown, string, string | null][] = [
	[
		'p1',
		{
			Amount: 6000,
			Currency: 'VND',
			ApprovalCode: '940172',
			items: [{ sku: 'A' }, { sku: 2 }, 'z'],
			flag: true,
			dimensions: { width: 10 },
		},
		['x', 'y'],
		'published',
		'o1',
	],
	['p2', { Amount: 7000, items: [], flag: false }, [], 'draft', 'o2'],
	['p3', { Amount: '6000', items: 'notarray' }, null, 'draft', null],
	['p4', { Amount: 'abc' }, null, 'draft', null],
	['p5', { Amount: null }, null, 'draft', null],
	['p6', null, null, 'draft', null],
	['p7', { 'a.b': { c: 1 }, a: { b: { c: 2 } } }, null, 'draft', null],
];

beforeAll(async () => {
	token = await adminToken('directus');

	await createUserCollection(ORDERS, [
		{ field: 'code', type: 'string' },
		{ field: 'details', type: 'json', meta: { special: ['cast-json'] } },
	]);

	await createUserCollection(PAYMENTS, [
		{ field: 'title', type: 'string' },
		{ field: 'status', type: 'string' },
		{ field: 'transaction_data', type: 'json', meta: { special: ['cast-json'] } },
		{ field: 'labels', type: 'json', meta: { special: ['cast-json'] } },
	]);

	await createField(PAYMENTS, { field: 'order', type: 'integer', meta: { special: ['m2o'] } });
	await appRequest('directus', 'POST', '/relations', {
		collection: PAYMENTS,
		field: 'order',
		related_collection: ORDERS,
	});

	const orders = await appRequest('directus', 'POST', `/items/${ORDERS}`, ORDER_ROWS);
	const orderId = Object.fromEntries((orders.data as { id: number; code: string }[]).map((o) => [o.code, o.id]));

	await appRequest(
		'directus',
		'POST',
		`/items/${PAYMENTS}`,
		PAYMENT_ROWS.map(([title, transaction_data, labels, status, order]) => ({
			title,
			transaction_data,
			labels,
			status,
			order: order ? orderId[order] : null,
		})),
	);
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 300_000);

const get = (path: string, auth = token) => ({ path, headers: { authorization: `Bearer ${auth}` } });

const titles = (result: ParityResult) =>
	((result.backoffice.json as { data: { title: string }[] }).data ?? []).map((row) => row.title).sort();

/** A json path request: Directus 403 (D-184), Backoffice 200; only accepted differences. */
async function jsonPath(path: string, auth = token): Promise<ParityResult> {
	const result = await parity(get(path, auth));
	expect(result.differences, JSON.stringify(result.differences)).toEqual([]);
	expect(result.directus.status).toBe(403);
	expect(result.accepted.map((d) => d.id)).toContain('D-184');
	return result;
}

async function filtered(filter: Record<string, unknown>, extra = ''): Promise<string[]> {
	const result = await jsonPath(`/items/${PAYMENTS}?fields=title&limit=-1&filter=${json(filter)}${extra}`);
	expect(result.backoffice.status, result.backoffice.text).toBe(200);
	return titles(result);
}

/**
 * One request to one app, without the comparison (values that differ by design). `no-store`: both apps share the
 * response cache and its keys (feature 005), so the second app would otherwise answer with the first app's response.
 */
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

const CASES: [string, Record<string, unknown>, string[]][] = [
	['number _eq', { 'json(transaction_data, Amount, number)': { _eq: 6000 } }, ['p1']],
	['number _gt (string value from the query)', { 'json(transaction_data, Amount, number)': { _gt: '6500' } }, ['p2']],
	['number _in', { 'json(transaction_data, Amount, number)': { _in: [6000, 7000] } }, ['p1', 'p2']],
	['text matches the JSON string only', { 'json(transaction_data, Amount, text)': { _eq: '6000' } }, ['p3']],
	['default type is text', { 'json(transaction_data, Amount)': { _eq: 'abc' } }, ['p4']],
	[
		'number _null: missing, JSON null, other type, field null',
		{ 'json(transaction_data, Amount, number)': { _null: true } },
		['p3', 'p4', 'p5', 'p6', 'p7'],
	],
	['number _nnull', { 'json(transaction_data, Amount, number)': { _nnull: true } }, ['p1', 'p2']],
	['text _starts_with', { 'json(transaction_data, Currency, text)': { _starts_with: 'VN' } }, ['p1']],
	['text _icontains', { 'json(transaction_data, ApprovalCode, text)': { _icontains: '0172' } }, ['p1']],
	['boolean true', { 'json(transaction_data, flag, boolean)': { _eq: true } }, ['p1']],
	['boolean false', { 'json(transaction_data, flag, boolean)': { _eq: false } }, ['p2']],
	['nested path', { 'json(transaction_data, dimensions.width, number)': { _eq: 10 } }, ['p1']],
	['array index', { 'json(transaction_data, items[0].sku, text)': { _eq: 'A' } }, ['p1']],
	['[*] _eq', { 'json(transaction_data, items[*].sku, text)': { _eq: 'A' } }, ['p1']],
	['[*] number _gt', { 'json(transaction_data, items[*].sku, number)': { _gt: 1 } }, ['p1']],
	['[*] _neq: no element has another string', { 'json(transaction_data, items[*].sku, text)': { _neq: 'A' } }, []],
	[
		'[*] _null: an element without a string sku',
		{ 'json(transaction_data, items[*].sku, text)': { _null: true } },
		['p1'],
	],
	['[*] at the root of an array of strings', { 'json(labels, [*], text)': { _eq: 'y' } }, ['p1']],
	['a.b.c is a nested path, not the key "a.b"', { 'json(transaction_data, a.b.c, number)': { _eq: 2 } }, ['p7']],
	['m2o', { order: { 'json(details, total, number)': { _gt: 100 } } }, ['p1']],
	['m2o and [*]', { order: { 'json(details, items[*].sku, text)': { _eq: 'A' } } }, ['p1']],
	[
		'_or',
		{
			_or: [
				{ 'json(transaction_data, Amount, number)': { _eq: 7000 } },
				{ 'json(transaction_data, flag, boolean)': { _eq: true } },
			],
		},
		['p1', 'p2'],
	],
	[
		'_and with a plain field',
		{ _and: [{ 'json(transaction_data, Amount, number)': { _gte: 6000 } }, { status: { _eq: 'published' } }] },
		['p1'],
	],
	['path text is only data', { "json(transaction_data, a'b;--, text)": { _eq: 'x' } }, []],
];

describe.skipIf(!SUPPORTED)(`json path filters on ${vendor}`, () => {
	it.each(CASES)('%s', async (_name, filter, expected) => {
		expect(await filtered(filter)).toEqual(expected);
	});

	it('meta filter_count, SEARCH and ?export=csv use the same filter', async () => {
		const filter = { 'json(transaction_data, Amount, number)': { _eq: 6000 } };

		const counted = await jsonPath(`/items/${PAYMENTS}?fields=title&meta=filter_count&filter=${json(filter)}`);
		expect((counted.backoffice.json as { meta: { filter_count: number } }).meta.filter_count).toBe(1);

		const search = await parity({
			method: 'SEARCH',
			path: `/items/${PAYMENTS}`,
			headers: { authorization: `Bearer ${token}` },
			body: { query: { fields: ['title'], filter } },
		});

		expect(search.differences).toEqual([]);
		expect(titles(search)).toEqual(['p1']);

		const csv = await jsonPath(`/items/${PAYMENTS}?fields=title&export=csv&filter=${json(filter)}`);
		expect(csv.backoffice.text.trim().split('\n')).toEqual(['"title"', '"p1"']);
	});

	it('an unknown type, an operator of another type and a path syntax error are 400 at Backoffice', async () => {
		for (const filter of [
			{ 'json(transaction_data, Amount, money)': { _eq: 1 } },
			{ 'json(transaction_data, Amount, number)': { _contains: '6' } },
			{ 'json(transaction_data, items[, text)': { _eq: 'A' } },
			{ 'json(transaction_data, a[*].b[*], text)': { _eq: 'A' } },
		]) {
			const result = await jsonPath(`/items/${PAYMENTS}?filter=${json(filter)}`);
			expect(result.backoffice.status).toBe(400);
			expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_QUERY');
		}
	});

	it('requests without a json path stay identical (FR-012)', async () => {
		for (const path of [
			`/items/${PAYMENTS}?fields=title&sort=title&filter=${json({ status: { _eq: 'published' } })}`,
			`/items/${PAYMENTS}?fields=title&sort=title&filter=${json({ transaction_data: { _null: true } })}`,
			`/items/${PAYMENTS}?fields=title,json(transaction_data, Amount)&sort=title`,
			`/items/${PAYMENTS}?fields=title&sort=title&filter=${json({ 'json(transaction_data)': { _eq: 1 } })}`,
		]) {
			const result = await parity(get(path));
			assertParity(result);
			// D-01 (x-powered-by) only.
			expect(result.accepted.map((d) => d.id).filter((id) => id !== 'D-01')).toEqual([]);
		}
	});

	it('D-184.2: sort and typed fields with json() are Backoffice only', async () => {
		// `sort` as a query string list: a comma inside json() would split the plain string form (in both apps).
		const sorted = await jsonPath(
			`/items/${PAYMENTS}?fields=title&filter=${json({ title: { _in: ['p1', 'p2'] } })}&sort[0]=${encodeURIComponent('-json(transaction_data, Amount, number)')}`,
		);
		expect((sorted.backoffice.json as { data: { title: string }[] }).data.map((r) => r.title)).toEqual(['p2', 'p1']);

		const path = `/items/${PAYMENTS}?fields=title,json(transaction_data, Amount, number),json(transaction_data, flag, boolean)&sort=title&filter=${json({ title: { _in: ['p1', 'p3'] } })}`;
		const directus = await at('directus', path);
		const backoffice = await at('backoffice', path);

		expect(directus.status).toBe(200);
		expect(directus.body.data[0].transaction_data_Amount_number_json).toBeNull();

		expect(backoffice.body.data).toEqual([
			{ title: 'p1', transaction_data_Amount_number_json: 6000, transaction_data_flag_boolean_json: true },
			{ title: 'p3', transaction_data_Amount_number_json: null, transaction_data_flag_boolean_json: null },
		]);
	});

	it.runIf(POSTGRES)('a jsonb column filters the same way', async () => {
		await hostDb().raw('ALTER TABLE ?? ALTER COLUMN ?? TYPE jsonb USING ??::jsonb', [
			PAYMENTS,
			'transaction_data',
			'transaction_data',
		]);

		await appRequest('directus', 'POST', '/utils/cache/clear?system');

		for (const [, filter, expected] of CASES.filter(([, filter]) =>
			JSON.stringify(filter).includes('transaction_data'),
		)) {
			expect(await filtered(filter), JSON.stringify(filter)).toEqual(expected);
		}
	});
});

describe.skipIf(!SUPPORTED)('permissions (US5, FR-009, FR-011)', () => {
	it('the read permission is checked on the base json field and row filters still apply', async () => {
		const noJson = await createUser('directus', 'jp-nojson');
		const policy = await createPolicy('directus', 'jp-nojson', {
			permissions: [{ collection: PAYMENTS, action: 'read', fields: ['id', 'title', 'status'] }],
		});
		await attachPolicy('directus', policy, { user: noJson.id });

		const denied = await jsonPath(
			`/items/${PAYMENTS}?fields=title&filter=${json({ 'json(transaction_data, Amount, number)': { _eq: 6000 } })}`,
			noJson.token,
		);

		expect(denied.backoffice.status).toBe(403);
		expect((denied.backoffice.json as any).errors[0].extensions.code).toBe('FORBIDDEN');

		const published = await createUser('directus', 'jp-published');
		const rowPolicy = await createPolicy('directus', 'jp-published', {
			permissions: [
				{ collection: PAYMENTS, action: 'read', fields: ['*'], permissions: { status: { _eq: 'published' } } },
			],
		});
		await attachPolicy('directus', rowPolicy, { user: published.id });

		const rows = await jsonPath(
			`/items/${PAYMENTS}?fields=title&filter=${json({ 'json(transaction_data, Amount, number)': { _gte: 0 } })}`,
			published.token,
		);

		expect(titles(rows)).toEqual(['p1']);
	});

	it('D-185: a permission with a json path is refused at Backoffice, saved at Directus', async () => {
		const policy = await createPolicy('directus', 'jp-perm');
		const body = {
			collection: PAYMENTS,
			action: 'read',
			policy,
			fields: ['*'],
			permissions: { 'json(transaction_data, Amount, number)': { _eq: 1 } },
		};

		const backoffice = await at('backoffice', '/permissions', { method: 'POST', body: JSON.stringify(body) });
		expect(backoffice.status).toBe(400);
		expect(backoffice.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');

		const directus = await at('directus', '/permissions', { method: 'POST', body: JSON.stringify(body) });
		expect(directus.status).toBe(200);
		await appRequest('directus', 'DELETE', `/permissions/${directus.body.data.id}`);

		const plain = await appRequest('directus', 'POST', '/permissions', {
			...body,
			permissions: { title: { _nnull: true } },
		});
		const patch = { validation: { 'json(transaction_data, a)': { _eq: 'x' } } };
		const patched = await at('backoffice', `/permissions/${plain.data.id}`, {
			method: 'PATCH',
			body: JSON.stringify(patch),
		});
		expect(patched.status).toBe(400);
		expect(patched.body.errors[0].extensions.code).toBe('INVALID_PAYLOAD');
	});
});

describe.skipIf(SUPPORTED)(`json path filters are refused on ${vendor} (FR-008)`, () => {
	it('Directus 403, Backoffice 400 naming the vendor', async () => {
		const result = await jsonPath(
			`/items/${PAYMENTS}?filter=${json({ 'json(transaction_data, Amount, number)': { _eq: 6000 } })}`,
		);

		expect(result.backoffice.status).toBe(400);
		expect((result.backoffice.json as any).errors[0].message).toMatch(
			/Filtering by a JSON path is not supported on \w+/,
		);
	});
});
