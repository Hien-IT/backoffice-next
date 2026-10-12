// Feature 007, US6 (spec FR-070 to FR-072, SC-006): with STORAGE_LOCATIONS=local,s3 both apps report one storage check
// per location, the same upload settings in /server/info, and put an upload without `storage` into the first location.
// The startup cases (a gcs location among supported ones, no warning for the file variables) are in startup.test.ts.
import { afterAll, describe, expect, it } from 'vitest';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { getStorages } from '../config.js';
import { appRequest } from '../directus-api.js';
import { admin, call, fixture, idsOf, multipart } from '../files/helpers.js';
import { listObjects } from '../files/storage-capture.js';
import { assertParity, capture, parity } from '../parity.js';

const created: string[] = [];

afterAll(async () => {
	const ids = created.splice(0);
	if (ids.length) await appRequest('directus', 'DELETE', '/files', ids).catch(() => undefined);
}, 120_000);

describe('storage locations local,s3 (US6)', () => {
	it('/server/health for the admin: the same checks at both apps, one per location', async () => {
		const checks = async (url: string) => {
			const res = await capture(url, { path: '/server/health', headers: await admin() });
			const json = res.json as { status: string; checks: Record<string, { status: string }[]> };
			return {
				status: json.status,
				checks: Object.fromEntries(Object.entries(json.checks).map(([key, list]) => [key, list.map((c) => c.status)])),
			};
		};

		const directus = await checks(urls().directus);
		const backoffice = await checks(urls().backoffice);

		expect(backoffice).toEqual(directus);
		expect(Object.keys(directus.checks).filter((key) => key.startsWith('storage:'))).toEqual([
			'storage:local:responseTime',
			'storage:s3:responseTime',
		]);
	});

	it.each([
		['main pair (TUS off)', undefined],
		['cors-hsts pair (TUS on)', 'cors-hsts' as const],
	])('/server/info for a user: files and uploads, %s', async (_name, profile) => {
		const pair = urls(profile);
		const result = await parity(
			{
				path: '/server/info',
				headers: await admin(),
				normalize: (c) => ({
					...c,
					json: { files: (c.json as any)?.data?.files, uploads: (c.json as any)?.data?.uploads },
				}),
			},
			{ directusUrl: pair.directus, backofficeUrl: pair.backoffice },
		);

		assertParity(result);
		expect((result.directus.json as any).uploads).toEqual(profile ? { tus: true, chunkSize: 8388608 } : undefined);
	});

	it.each([['default', undefined] as const, ...getStorages().map((s) => [s, s] as const)])(
		'upload with storage %s lands in the same location at both apps',
		async (_name, storage) => {
			const transcripts = await scenario(urls(), async (ctx) => {
				const { body, headers } = multipart([
					...(storage ? [{ name: 'storage', value: storage }] : []),
					{ name: 'file', data: fixture('photo.jpg'), filename: 'photo.jpg', contentType: 'image/jpeg' },
				]);

				const res = await call(ctx, {
					method: 'POST',
					path: '/files',
					headers: { ...(await admin()), ...headers },
					body,
				});
				const [id] = idsOf(res);
				if (id) created.push(id);

				const location = (res.json as any)?.data?.storage as 'local' | 's3';
				return { status: res.status, location, objects: id ? (await listObjects(location, id)).length : 0 };
			});

			assertSameTranscripts(transcripts, `storage ${storage ?? 'default'}`);
			expect(transcripts.directus).toEqual({ status: 200, location: storage ?? 'local', objects: 1 });
		},
		60_000,
	);
});
