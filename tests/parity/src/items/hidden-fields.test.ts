// Spec 005 (D-209): a field hidden in the data model (directus_fields.hidden) of a user collection is left out of a
// wildcard read at Backoffice (`*`, `*.*`, no `fields`, export); Directus 11.17.4 returns it. Named in `fields` (or an
// alias) it is returned at both. The primary key stays, system collections keep the Directus answer. Reads of the
// shared DB go to both apps at once (parity()); the difference is accepted as D-209.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, appRequest } from '../directus-api.js';
import { assertParity, type ParityRequest, parity } from '../parity.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createUser,
	createUserCollection,
	type TestUser,
} from '../permissions/fixtures.js';

const run = Math.random().toString(16).slice(2, 10);
const ITEMS = `parity_hidden_${run}`;
const PARENT = `parity_hidden_p_${run}`;

let admin = '';
/** Reads ITEMS and PARENT with fields `*`. */
let star: TestUser;
/** Reads ITEMS with fields `id`, `secret` only. */
let narrow: TestUser;

const as = (token: string, req: ParityRequest) => parity({ ...req, headers: { authorization: token, ...req.headers } });

/** Both answer 200 and the body of each side. */
async function read(token: string, path: string) {
	const result = await as(token, { path });
	expect([result.directus.status, result.backoffice.status]).toEqual([200, 200]);
	assertParity(result);
	return { directus: result.directus.json as any, backoffice: result.backoffice.json as any, result };
}

beforeAll(async () => {
	admin = `Bearer ${await adminToken('directus')}`;

	await createUserCollection(ITEMS, [
		{ field: 'title', type: 'string' },
		{ field: 'secret', type: 'string', meta: { hidden: true } },
	]);

	await createUserCollection(PARENT, [
		{ field: 'name', type: 'string' },
		{ field: 'child', type: 'integer' },
	]);

	await appRequest('directus', 'POST', '/relations', { collection: PARENT, field: 'child', related_collection: ITEMS });

	const item = await appRequest('directus', 'POST', `/items/${ITEMS}`, { title: 'one', secret: 'kept' });
	await appRequest('directus', 'POST', `/items/${PARENT}`, { name: 'parent', child: item.data.id });

	const starPolicy = await createPolicy('directus', `hidden-star-${run}`, {
		permissions: [ITEMS, PARENT].map((collection) => ({ collection, action: 'read', fields: ['*'], permissions: {} })),
	});

	star = await createUser('directus', `hidden-star-${run}`);
	await attachPolicy('directus', starPolicy, { user: star.id });

	const narrowPolicy = await createPolicy('directus', `hidden-narrow-${run}`, {
		permissions: [{ collection: ITEMS, action: 'read', fields: ['id', 'secret'], permissions: {} }],
	});

	narrow = await createUser('directus', `hidden-narrow-${run}`);
	await attachPolicy('directus', narrowPolicy, { user: narrow.id });
});

afterAll(cleanup);

describe.each([
	['admin', () => admin],
	['user with fields *', () => `Bearer ${star.token}`],
])('%s', (_label, token) => {
	it.each(['', '?fields=*', '?fields=*,title'])(
		'"%s": the hidden field is left out, the primary key stays',
		async (query) => {
			const { directus, backoffice, result } = await read(token(), `/items/${ITEMS}${query}`);
			expect(backoffice.data).toEqual([{ id: expect.anything(), title: 'one' }]);
			expect(directus.data[0]).toMatchObject({ id: backoffice.data[0].id, secret: 'kept' });
			expect(result.accepted.map((d) => d.id)).toContain('D-209');
		},
	);

	it.each(['?fields=id,secret', '?fields=*,secret'])(
		'"%s": the named hidden field is returned at both',
		async (query) => {
			const { directus, backoffice, result } = await read(token(), `/items/${ITEMS}${query}`);
			expect(backoffice.data[0]).toMatchObject({ secret: 'kept' });
			expect(backoffice.data).toEqual(directus.data);
			expect(result.accepted.map((d) => d.id)).not.toContain('D-209');
		},
	);

	it('an alias of the hidden field is returned with *', async () => {
		const { directus, backoffice } = await read(token(), `/items/${ITEMS}?fields=*&alias[s]=secret`);
		expect(backoffice.data).toEqual([{ id: expect.anything(), title: 'one', s: 'kept' }]);
		expect(directus.data[0]).toMatchObject({ s: 'kept', secret: 'kept' });
	});

	it('*.* leaves the hidden field out of the related item', async () => {
		const { directus, backoffice } = await read(token(), `/items/${PARENT}?fields=*.*`);
		expect(backoffice.data[0].child).toEqual({ id: expect.anything(), title: 'one' });
		expect(directus.data[0].child).toMatchObject({ secret: 'kept' });
	});
});

// a user needs the export permission of spec 025 at Backoffice (403 there), so the admin alone
it('export leaves the hidden field out', async () => {
	const { directus, backoffice } = await read(admin, `/items/${ITEMS}?export=json`);
	expect(backoffice).toEqual([{ id: expect.anything(), title: 'one' }]);
	expect(directus[0]).toMatchObject({ secret: 'kept' });
});

describe('user allowed id and secret only', () => {
	it('* gives the primary key only; the named hidden field is returned', async () => {
		const token = () => `Bearer ${narrow.token}`;
		const star = await read(token(), `/items/${ITEMS}?fields=*`);
		expect(star.backoffice.data).toEqual([{ id: expect.anything() }]);
		expect(star.directus.data[0]).toMatchObject({ secret: 'kept' });

		const named = await read(token(), `/items/${ITEMS}?fields=secret`);
		expect(named.backoffice.data).toEqual([{ secret: 'kept' }]);
		expect(named.backoffice.data).toEqual(named.directus.data);
	});
});

it('a system collection keeps its hidden fields with * (tfa_secret of a user)', async () => {
	const { backoffice, result } = await read(admin, `/users/${narrow.id}?fields=*`);
	expect(backoffice.data).toHaveProperty('tfa_secret');
	expect(result.accepted.map((d) => d.id)).not.toContain('D-209');
});
