// Feature 006, US3 and the acceptance criterion (FR-043, FR-062, SC-004, SC-006): a full data model built through one
// app (every field type, a folder, m2o and o2m, m2m, m2a, files, translations, a singleton, presentation and group
// fields, archive and sort settings) is the same model at the other app: equal snapshots, a 204 diff, nested item
// writes, archive and sort clean-up; then the other way round.
import knex, { type Knex } from 'knex';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { knexConfig } from '../config.js';
import { type AppName, adminToken, appRequest, appUrl } from '../directus-api.js';
import { getDbsToTest } from '../get-dbs-to-test.js';
import { capture } from '../parity.js';
import { createFixture, dropFixture, FIXTURE_COLLECTIONS } from '../schema/fixture.js';
import { schemaShape } from './ddl-capture.js';

const [vendor] = getDbsToTest();
const P = 'parity_overview_';

let db: Knex;

beforeAll(() => {
	db = knex(knexConfig[vendor!]);
});

afterAll(async () => {
	await dropFixture();
	await db.destroy();
});

const snapshotText = async (app: AppName) =>
	(
		await capture(appUrl(app), {
			path: '/schema/snapshot',
			headers: { authorization: `Bearer ${await adminToken(app)}`, 'cache-control': 'no-store' },
		})
	).text;

describe.each([
	['directus', 'backoffice'],
	['backoffice', 'directus'],
] as [AppName, AppName][])('built at %s, used at %s', (builder, user) => {
	let before: Awaited<ReturnType<typeof schemaShape>>;

	beforeAll(async () => {
		await dropFixture();
		before = await schemaShape(db);
		await createFixture(vendor!, builder);
	}, 300_000);

	it('the same snapshot at both apps, and the snapshot of one diffed at the other is 204', async () => {
		const [fromBuilder, fromUser] = [await snapshotText(builder), await snapshotText(user)];
		expect(fromUser).toBe(fromBuilder);

		const res = await fetch(new URL('/schema/diff', appUrl(user)), {
			method: 'POST',
			headers: { authorization: `Bearer ${await adminToken(user)}`, 'content-type': 'application/json' },
			body: JSON.stringify(JSON.parse(fromBuilder).data),
		});
		expect(res.status).toBe(204);
	});

	it('items written at the other app through every relation, read back nested', async () => {
		const related = (await appRequest(user, 'POST', `/items/${P}related`, { name: 'r1' })).data.id;
		await appRequest(user, 'POST', `/items/${P}languages`, { id: 'vi-VN', name: 'Vietnamese' });

		const created = await appRequest(user, 'POST', `/items/${P}types?fields=id`, {
			title: 'cross use',
			related,
			tags: [{ related_id: related }],
			blocks: [{ collection: `${P}related`, item: String(related) }],
			translations: [{ languages_id: 'vi-VN', label: 'Xin chào' }],
		});

		const read = await appRequest(
			user,
			'GET',
			`/items/${P}types/${created.data.id}?fields=title,status,related.name,tags.related_id.name,blocks.collection,blocks.item:${P}related.name,translations.label`,
		);

		expect(read.data).toEqual({
			title: 'cross use',
			status: 'draft',
			related: { name: 'r1' },
			tags: [{ related_id: { name: 'r1' } }],
			blocks: [{ collection: `${P}related`, item: { name: 'r1' } }],
			translations: [{ label: 'Xin chào' }],
		});

		// The singleton answers the same object at both apps.
		const singleton = await appRequest(user, 'GET', `/items/${P}singleton`);
		expect(singleton).toEqual(await appRequest(builder, 'GET', `/items/${P}singleton`));
	});

	it('deleting the archive and sort fields at the other app clears them in directus_collections (US3.5)', async () => {
		await appRequest(user, 'DELETE', `/fields/${P}types/status`);
		await appRequest(user, 'DELETE', `/fields/${P}types/sort`);

		const meta = await db('directus_collections')
			.where({ collection: `${P}types` })
			.first();
		expect(meta).toMatchObject({ archive_field: null, sort_field: null, group: `${P}folder` });
	});

	it('the model deleted at the other app: the database is back to its shape', async () => {
		for (const collection of FIXTURE_COLLECTIONS) await appRequest(user, 'DELETE', `/collections/${collection}`);
		expect(await schemaShape(db)).toEqual(before);
	});
});
