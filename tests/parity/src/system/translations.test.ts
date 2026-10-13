// Feature 010, US6 (spec FR-050, contracts/system-api.md §2): /translations at both apps. Reads go to both apps at
// once (the query of stores/translations.ts); writes run as scenarios with the rows each app writes, including the
// duplicate key and language checks of TranslationsService (400 even without a duplicate when several keys get both
// fields, as in Directus).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { appRequest } from '../directus-api.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, same, snap, systemEffects } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const KEY = `parity_tr_${run}`;

let appUser: TestUser; // app access: the minimal read of directus_translations
let seeded: string[];

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

/** A row `<key>_second` in en-US, written straight in the database; its id. */
async function second(key: string): Promise<string> {
	const id = randomUUID();
	await hostDb()('directus_translations').insert({ id, key: `${key}_second`, language: 'en-US', value: 'second' });
	return id;
}

beforeAll(async () => {
	const appPolicy = await createPolicy('directus', 'translations-app', { app: true });
	appUser = await createUser('directus', 'translations-app');
	await attachPolicy('directus', appPolicy, { user: appUser.id });

	const rows = await appRequest('directus', 'POST', '/translations', [
		{ key: KEY, language: 'en-US', value: 'Hello' },
		{ key: KEY, language: 'vi-VN', value: 'Xin chào' },
	]);
	seeded = rows.data.map((row: any) => row.id);
}, 300_000);

afterAll(async () => {
	await hostDb()('directus_translations').where('key', 'like', `${KEY}%`).delete();
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('reads at both apps', () => {
	it('the query of stores/translations.ts as the app access user, admin reads, public', async () => {
		const filter = encodeURIComponent(
			JSON.stringify({ _and: [{ language: { _eq: 'vi-VN' } }, { key: { _eq: KEY } }] }),
		);

		await same({ path: `/translations?fields=language,key,value&filter=${filter}&limit=-1`, headers: bearer(appUser) });
		await same({ path: `/translations?filter[key][_eq]=${KEY}&sort=language&meta=*`, headers: await admin() });
		await same({ path: `/translations/${seeded[0]}`, headers: await admin() });
		await same({ path: `/translations/${seeded[0]}` });
		await same({ method: 'OPTIONS', path: '/translations' });
	});
});

describe('writes as scenarios', () => {
	it('create, duplicates on create and update, update of one field, delete; the app user may not write', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const key = `${KEY}_w`;

			const { result: created, rows } = await systemEffects(['translations'], () =>
				call(ctx, { method: 'POST', path: '/translations', headers, body: { key, language: 'en-US', value: 'One' } }),
			);
			const id = (created.json as any)?.data?.id as string;
			const ids = { tr: id };

			const steps = {
				created: snap(created, '/translations', ids),
				rows: comparable(rows, ids),
				duplicate: snap(
					await call(ctx, {
						method: 'POST',
						path: '/translations',
						headers,
						body: { key, language: 'en-US', value: 'Two' },
					}),
					'/translations',
					ids,
				),
				duplicateInArray: snap(
					await call(ctx, {
						method: 'POST',
						path: '/translations',
						headers,
						body: [
							{ key: `${key}_a`, language: 'fr-FR', value: 'a' },
							{ key, language: 'en-US', value: 'b' },
						],
					}),
					'/translations',
					ids,
				),
				bothFields: snap(
					await call(ctx, {
						method: 'PATCH',
						path: '/translations',
						headers,
						body: { keys: [id], data: { key: `${key}_new`, language: 'de-DE' } },
					}),
					'/translations',
					ids,
				),
				// A second row of this run (same language, other key) renamed to the key of the first one.
				toDuplicate: snap(
					await call(ctx, {
						method: 'PATCH',
						path: `/translations/${await second(key)}`,
						headers,
						body: { key },
					}),
					'/translations',
					ids,
				),
				oneField: snap(
					await call(ctx, { method: 'PATCH', path: `/translations/${id}`, headers, body: { language: 'fr-FR' } }),
					'/translations',
					ids,
				),
				value: snap(
					await call(ctx, { method: 'PATCH', path: `/translations/${id}`, headers, body: { value: 'Une' } }),
					'/translations',
					ids,
				),
				appUserWrite: snap(
					await call(ctx, {
						method: 'POST',
						path: '/translations',
						headers: bearer(appUser),
						body: { key: `${key}_u`, language: 'en-US', value: 'u' },
					}),
					'/translations',
					ids,
				),
				deleted: snap(
					await call(ctx, { method: 'DELETE', path: `/translations/${id}`, headers }),
					'/translations',
					ids,
				),
			};

			await hostDb()('directus_translations').where('key', 'like', `${key}%`).delete();
			return steps;
		});

		assertSameTranscripts(transcripts, 'translations');
	});

	it('a string written at one app is read at the other', async () => {
		for (const [writer, reader] of [
			['directus', 'backoffice'],
			['backoffice', 'directus'],
		] as const) {
			const key = `${KEY}_cross_${writer}`;
			await appRequest(writer, 'POST', '/translations', { key, language: 'en-US', value: writer });
			const read = await appRequest(reader, 'GET', `/translations?filter[key][_eq]=${key}&fields=key,value`);
			if (read.data[0]?.value !== writer) throw new Error(`${reader} did not read the string written at ${writer}`);
		}
	});
});
