// Feature 006, US3.4 and FR-050 (SC-005): a schema change made through the API of the new app is seen by Directus and
// by the second Backoffice instance within 1 second, without restart; the shared response cache is cleared too. The
// reverse of schema/sync.test.ts (feature 002, FR-020 checked again through the API). Needs the profile `multi`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adminToken, directusRequest } from '../directus-api.js';
import { closeRedis } from '../redis.js';
import { createPublicCollection, dropCollections, oasComponent, within } from '../schema/helpers.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const DIRECTUS = process.env['DIRECTUS_URL']!;
const BACKOFFICE = process.env['BACKOFFICE_URL']!;
const BACKOFFICE_2 = process.env['BACKOFFICE_URL_2']!;
const SC_005_MS = 1000;
const C = 'parity_sm_sync';
const C2 = 'parity_sm_sync_b';

const fieldsOf = async (url: string, collection = C) =>
	Object.keys((await oasComponent(url, collection))?.['properties'] ?? {}).sort();

/** A request made through the new app (the main-pair admin token is valid at both apps). */
const backoffice = (method: string, path: string, body?: unknown) => directusRequest(method, path, body, BACKOFFICE);

/** Waits until Directus and the second Backoffice instance show what the first instance shows; returns the delay. */
async function othersFollow(what: string, collection = C): Promise<number> {
	const expected = JSON.stringify(await oasComponent(BACKOFFICE, collection));

	const delays = await Promise.all(
		[DIRECTUS, BACKOFFICE_2].map((url) =>
			within(
				SC_005_MS,
				async () => JSON.stringify(await oasComponent(url, collection)) === expected,
				`${url} sees "${what}"`,
			),
		),
	);

	const delay = Math.max(...delays);
	// eslint-disable-next-line no-console -- SC-005 delay, read from the CI log
	console.info(`[SC-005] Backoffice API → Directus and backoffice-api-2, ${what}: ${delay} ms`);
	return delay;
}

describe.runIf(suite === 'full' && BACKOFFICE_2)(
	'schema changes through the API of the new app (US3.4, SC-005)',
	() => {
		beforeAll(async () => {
			await dropCollections([C2, C]);
			await createPublicCollection(C, undefined, {}, BACKOFFICE);

			for (const url of [DIRECTUS, BACKOFFICE, BACKOFFICE_2]) expect(await fieldsOf(url)).toEqual(['id', 'title']);
		}, 120_000);

		afterAll(async () => {
			await dropCollections([C2, C]);
			await closeRedis();
		}, 120_000);

		it('field added, type changed, field deleted, collection and relation created and deleted', async () => {
			await backoffice('POST', `/fields/${C}`, { field: 'rating', type: 'integer' });
			await othersFollow('field added');
			expect(await fieldsOf(DIRECTUS)).toEqual(['id', 'rating', 'title']);

			await backoffice('PATCH', `/fields/${C}/rating`, { type: 'float' });
			await othersFollow('field type changed');

			await backoffice('DELETE', `/fields/${C}/rating`);
			await othersFollow('field deleted');

			await createPublicCollection(C2, undefined, {}, BACKOFFICE);
			await othersFollow('collection created', C2);

			await backoffice('POST', `/fields/${C}`, { field: 'b', type: 'integer', meta: { special: ['m2o'] } });
			await backoffice('POST', '/relations', { collection: C, field: 'b', related_collection: C2 });
			await othersFollow('m2o relation created');
			expect(JSON.stringify(await oasComponent(DIRECTUS, C))).toContain('ItemsParitySmSyncB');

			await backoffice('DELETE', `/relations/${C}/b`);
			await othersFollow('relation deleted');

			await backoffice('DELETE', `/collections/${C2}`);
			await within(SC_005_MS, async () => (await oasComponent(DIRECTUS, C2)) === undefined, 'collection deleted');
		});

		it('a diff applied through the new app', async () => {
			const snapshot = (await backoffice('GET', '/schema/snapshot')).data;
			// With meta: a column without a directus_fields row is not in snapshots (getSnapshot drops meta === null).
			await backoffice('POST', `/fields/${C}`, { field: 'extra', type: 'string', meta: {} });
			await othersFollow('field added before the apply');

			const { data } = await backoffice('POST', '/schema/diff', snapshot);
			await backoffice('POST', '/schema/apply', data);
			await othersFollow('diff applied');
			expect(await fieldsOf(DIRECTUS)).not.toContain('extra');
		});

		it('the shared response cache: a cached GET at Directus is a MISS with new data after a change at the new app', async () => {
			const token = await adminToken('directus');
			const get = () =>
				fetch(new URL(`/fields/${C}/title`, DIRECTUS), { headers: { authorization: `Bearer ${token}` } });

			expect((await get()).headers.get('x-cache-status')).toBe('MISS');
			const cached = await get();
			expect(cached.headers.get('x-cache-status')).toBe('HIT');
			expect(((await cached.json()) as any).data.meta?.note ?? null).toBeNull();

			await backoffice('PATCH', `/fields/${C}/title`, { meta: { note: 'changed at the new app' } });

			const after = await get();
			expect(after.headers.get('x-cache-status')).toBe('MISS');
			expect(((await after.json()) as any).data.meta.note).toBe('changed at the new app');
		});
	},
);
