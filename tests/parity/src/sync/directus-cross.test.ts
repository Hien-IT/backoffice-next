// Spec 032 US6 (FR-029, SC-007, analyze C1, profile sync): when the target shares its database and Redis with Directus
// (the main pair), Directus reads and edits the rows an apply wrote, and sees a later apply at once (its caches cleared).
// Source: backoffice-api-sync (profile sync), reached from the main Backoffice as http://backoffice-api-sync:8055.
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { appRequest, directusRequest } from '../directus-api.js';
import { TARGET, TARGET_TOKEN, target, uuid } from './helpers.js';
import { collectionBody, flowBody } from './seed.js';

const run = uuid().slice(0, 8);
const collection = `parity_sync_x_${run}`;
const flow = uuid();
const SOURCE = 'http://backoffice-api-sync:8055';

const sync = async (groups: string[], pick: (rows: any[]) => string[]) => {
	const compared = (
		await appRequest('backoffice', 'POST', '/backoffice/sync/diff', { url: SOURCE, token: TARGET_TOKEN, groups })
	).data;
	return appRequest('backoffice', 'POST', '/backoffice/sync/apply', {
		url: SOURCE,
		token: TARGET_TOKEN,
		hash: compared.hash,
		groups,
		selected: pick(compared.rows),
	});
};

describe.skipIf(!TARGET)('profile sync: Directus on the target database', () => {
	beforeAll(async () => {
		for (const [path, body] of [
			['/collections', collectionBody(collection)],
			['/flows', flowBody(flow, `Cross flow ${run}`)],
		] as const) {
			const answer = await target('POST', path, body);
			if (answer.status >= 300) throw new Error(`seed ${path}: ${answer.status} ${JSON.stringify(answer.body)}`);
		}
	}, 120_000);

	afterAll(async () => {
		await target('DELETE', `/flows/${flow}`);
		await target('DELETE', `/collections/${collection}`);
		await directusRequest('DELETE', `/flows/${flow}`).catch(() => undefined);
		await directusRequest('DELETE', `/collections/${collection}`).catch(() => undefined);
	}, 120_000);

	test('Directus reads, fills and edits what Backoffice applied; a second apply is visible to it at once', async () => {
		await sync(['schema', 'flows'], () => [`schema/collection:${collection}`, `flows/flow:${flow}`]);

		expect((await directusRequest('GET', `/flows/${flow}`)).data.name).toBe(`Cross flow ${run}`);
		expect((await directusRequest('GET', `/collections/${collection}`)).data.collection).toBe(collection);
		await directusRequest('POST', `/items/${collection}`, { title: 'written by Directus' });
		await directusRequest('PATCH', `/flows/${flow}`, { description: 'edited by Directus' });

		// Warm the response cache of Directus, rename at the source, apply again: Directus must not serve the old name.
		await directusRequest('GET', `/flows/${flow}`);
		const renamed = await target('PATCH', `/flows/${flow}`, { name: `Cross flow renamed ${run}` });
		expect(renamed.status).toBe(200);

		await sync(['flows'], () => [`flows/flow:${flow}`]);
		expect((await directusRequest('GET', `/flows/${flow}`)).data.name).toBe(`Cross flow renamed ${run}`);
	}, 240_000);
});
