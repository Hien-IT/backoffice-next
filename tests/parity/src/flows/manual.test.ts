// Feature 009 (T020; spec US1 ca 5, 6, FR-012; contracts/flows-api.md §3): manual flows with the request bodies of the
// Directus app (composables/use-flows.ts), the six 403 checks in order, and a non-admin user.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { appRequest } from '../directus-api.js';
import {
	attachPolicy,
	cleanup,
	createPolicy,
	createUser,
	createUserCollection,
	type TestUser,
	uniqueName,
} from '../permissions/fixtures.js';
import { cleanupFlows, same, seedFlow } from './helpers.js';

let collection: string;
let other: string;
let keys: number[];
let flowId: string;
let noSelection: string;
let noCollections: string;
let reader: TestUser;
let limited: TestUser;
const seeded: string[] = [];

const run = (id: string, body: unknown, token?: string) =>
	same({
		method: 'POST',
		path: `/flows/trigger/${id}`,
		body: body as Record<string, unknown>,
		...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
	});

beforeAll(async () => {
	collection = await createUserCollection(uniqueName('flows_manual').replace(/-/g, '_'), [
		{ field: 'title', type: 'string' },
	]);

	other = await createUserCollection(uniqueName('flows_other').replace(/-/g, '_'));

	keys = [];
	for (const title of ['a', 'b', 'c']) {
		keys.push((await appRequest('directus', 'POST', `/items/${collection}`, { title })).data.id);
	}

	const echo = [{ key: 'echo', type: 'transform', options: { json: '{{ $trigger.body }}' } }];

	for (const [options, target] of [
		[{ collections: [collection, other] }, 'flow'],
		[{ collections: [collection], requireSelection: false }, 'noSelection'],
		[{ collections: [] }, 'noCollections'],
	] as const) {
		const { id } = await seedFlow({ trigger: 'manual', options, operations: echo });
		seeded.push(id);
		if (target === 'flow') flowId = id;
		if (target === 'noSelection') noSelection = id;
		if (target === 'noCollections') noCollections = id;
	}

	// Reads every item of the collection; `limited` reads only the item titled "a".
	const readAll = await createPolicy('directus', 'flows-manual-all', {
		permissions: [{ collection, action: 'read', fields: ['*'] }],
	});

	const readOne = await createPolicy('directus', 'flows-manual-one', {
		permissions: [{ collection, action: 'read', fields: ['*'], permissions: { title: { _eq: 'a' } } }],
	});

	reader = await createUser('directus', 'flows-manual-reader');
	limited = await createUser('directus', 'flows-manual-limited');
	await attachPolicy('directus', readAll, { user: reader.id });
	await attachPolicy('directus', readOne, { user: limited.id });
}, 120_000);

afterAll(async () => {
	await cleanupFlows(seeded);
	await cleanup();
});

describe('as the Directus app sends it', () => {
	test('item page and selection: { collection, keys, ...fields } is $trigger.body; the result is $last', async () => {
		const body = { collection, keys: [keys[0]], confirm: 'yes' };
		const result = await run(flowId, body, (await adminToken()).token);

		expect(result.directus.status).toBe(200);
		expect(result.directus.json).toEqual(body);
	});

	test('collection page without a selection when requireSelection is false', async () => {
		const result = await run(noSelection, { collection }, (await adminToken()).token);
		expect(result.directus.json).toEqual({ collection });
	});
});

describe('403 in the order of Directus', () => {
	test.each([
		['no collection', () => ({ keys: [1] })],
		['collection not enabled', () => ({ collection: 'directus_users', keys: [1] })],
		['keys missing', () => ({ collection })],
		['keys empty', () => ({ collection, keys: [] })],
	])('%s', async (_label, body) => {
		expect((await run(flowId, body(), (await adminToken()).token)).directus.status).toBe(403);
	});

	test('no collections configured', async () => {
		expect((await run(noCollections, { collection, keys: [1] }, (await adminToken()).token)).directus.status).toBe(403);
	});

	test('not authenticated', async () => {
		expect((await run(flowId, { collection, keys: [keys[0]] })).directus.status).toBe(403);
	});
});

describe('non-admin users', () => {
	test('read permission on the collection and every key: runs; keys as numbers or strings', async () => {
		expect((await run(flowId, { collection, keys: [keys[0], String(keys[1])] }, reader.token)).directus.status).toBe(
			200,
		);
	});

	test('no read permission on the collection: 403', async () => {
		expect((await run(flowId, { collection: other, keys: [1] }, reader.token)).directus.status).toBe(403);
	});

	test('one key not readable: 403; only readable keys: 200', async () => {
		expect((await run(flowId, { collection, keys: [keys[0], keys[1]] }, limited.token)).directus.status).toBe(403);
		expect((await run(flowId, { collection, keys: [keys[0]] }, limited.token)).directus.status).toBe(200);
	});
});

/** A user with an admin policy attached to it; its static token works at both apps. */
async function adminToken(): Promise<TestUser> {
	cachedAdmin ??= (async () => {
		const user = await createUser('directus', 'flows-manual-admin');
		await attachPolicy('directus', await createPolicy('directus', 'flows-manual-admin', { admin: true, app: true }), {
			user: user.id,
		});
		return user;
	})();

	return cachedAdmin;
}

let cachedAdmin: Promise<TestUser> | undefined;
