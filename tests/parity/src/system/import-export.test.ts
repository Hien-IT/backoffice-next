// Feature 010, US5 ca 5, 6 (spec FR-084, FR-085, FR-102, contracts/utils-api.md §5, §6): import and export at both
// apps. Imports run as scenarios (each app imports the same file into an emptied collection) and compare the answer
// and the rows; the background import leaves a notification; the concurrent import counter is the same Redis key for
// both apps. Exports run at Directus, then at Backoffice; the file rows are compared and the bytes of each file, read
// through /assets at both apps, must be equal (after the time in the title and the download name). Full suite only.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, scenario } from '../auth/scenario.js';
import { type AppName, appRequest } from '../directus-api.js';
import { multipart } from '../files/helpers.js';
import { until } from '../flows/helpers.js';
import { capture } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { closeRedis, redis } from '../redis.js';
import { admin, call, comparable, same, snap } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const BOOKS = `parity_ie_${run}`;
const full = process.env['PARITY_SUITE'] !== 'reduced';
const COUNTER = 'directus:import-export:importCount';

let reader: TestUser; // read only on BOOKS
let adminId: string;

beforeAll(async () => {
	if (!full) return;

	await appRequest('directus', 'POST', '/collections', {
		collection: BOOKS,
		schema: {},
		meta: { accountability: 'all' },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string', meta: { required: true }, schema: { is_nullable: true } },
			{ field: 'pages', type: 'integer', meta: {}, schema: {} },
			{ field: 'meta', type: 'json', meta: { special: ['cast-json'] }, schema: {} },
		],
	});

	const readOnly = await createPolicy('directus', 'ie-read', {
		app: true,
		permissions: [{ collection: BOOKS, action: 'read' as const, fields: ['*'], permissions: {} }],
	});
	reader = await createUser('directus', 'ie-reader');
	await attachPolicy('directus', readOnly, { user: reader.id });
	adminId = (await appRequest('directus', 'GET', '/users/me?fields=id')).data.id;
}, 300_000);

afterAll(async () => {
	if (!full) return;
	await hostDb()('directus_notifications')
		.where({ recipient: adminId })
		.andWhere('subject', 'like', '%import%')
		.delete();
	await appRequest('directus', 'DELETE', `/collections/${BOOKS}`);
	await cleanup();
	await closeHostDb();
	await closeRedis();
}, 120_000);

const CSV = 'title,pages,meta\n"Dune",412,"{""a"":1}"\n"Emma",320,\n';
const JSON_FILE = JSON.stringify([
	{ title: 'Ulysses', pages: 730, meta: { b: 2 } },
	{ title: 'Beloved', pages: 324 },
]);

const file = (data: string, contentType: string, filename: string) =>
	multipart([{ name: 'file', data: Buffer.from(data), filename, contentType }]);

const rows = async () =>
	(await hostDb()(BOOKS).select('title', 'pages', 'meta').orderBy('title')).map((row) => ({
		...row,
		meta: typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta,
	}));

async function empty() {
	await appRequest('directus', 'DELETE', `/items/${BOOKS}`, { query: { limit: -1 } });
}

describe.runIf(full)('POST /utils/import/:collection', () => {
	it('CSV and JSON files: same answer and same rows at both apps', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const out: Record<string, unknown> = {};

			for (const [name, body] of [
				['csv', file(CSV, 'text/csv', 'books.csv')],
				['excel csv', file(CSV, 'application/vnd.ms-excel', 'books.csv')],
				['json', file(JSON_FILE, 'application/json', 'books.json')],
			] as const) {
				await empty();
				const res = await call(ctx, {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers: { ...headers, ...body.headers },
					body: body.body,
				});
				out[name] = { res: snap(res, '/utils'), rows: await rows() };
			}

			return out;
		});

		assertSameTranscripts(transcripts, 'import');
		expect((transcripts.backoffice as any).csv.rows).toHaveLength(2);
	});

	it('errors in order: unknown collection, not multipart, system collection, permission, file type, row errors', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const xml = file('<data></data>', 'text/xml', 'books.xml');
			const yaml = file('- title: x', 'text/yaml', 'books.yaml');
			const invalid = file('title,pages\n,abc\n"Ok",1\n,2\n', 'text/csv', 'bad.csv');
			const csv = file(CSV, 'text/csv', 'books.csv');

			await empty();
			const out = {
				unknown: await call(ctx, {
					method: 'POST',
					path: '/utils/import/nope_collection',
					headers: { ...headers, ...csv.headers },
					body: csv.body,
				}),
				notMultipart: await call(ctx, { method: 'POST', path: `/utils/import/${BOOKS}`, headers, body: { a: 1 } }),
				system: await call(ctx, {
					method: 'POST',
					path: '/utils/import/directus_roles',
					headers: { authorization: `Bearer ${reader.token}`, ...csv.headers },
					body: csv.body,
				}),
				noPermission: await call(ctx, {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers: { authorization: `Bearer ${reader.token}`, ...csv.headers },
					body: csv.body,
				}),
				xml: await call(ctx, {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers: { ...headers, ...xml.headers },
					body: xml.body,
				}),
				yaml: await call(ctx, {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers: { ...headers, ...yaml.headers },
					body: yaml.body,
				}),
				invalid: await call(ctx, {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers: { ...headers, ...invalid.headers },
					body: invalid.body,
				}),
			};

			return {
				...Object.fromEntries(Object.entries(out).map(([name, res]) => [name, snap(res, '/utils')])),
				// A failed import is rolled back: no row of the file with errors is kept.
				rows: await rows(),
			};
		});

		assertSameTranscripts(transcripts, 'import errors');
		expect((transcripts.backoffice as any).xml.status).toBe(415);
	});

	it('background: 200 at once, then the rows and a notification for the caller', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			await empty();
			const last = Number((await hostDb().max({ m: 'id' }).from('directus_notifications').first())?.['m'] ?? 0);
			const body = file(CSV, 'text/csv', 'books.csv');
			const res = await call(ctx, {
				method: 'POST',
				path: `/utils/import/${BOOKS}?background=true`,
				headers: { ...(await admin()), ...body.headers },
				body: body.body,
			});

			await until(async () => Boolean(await hostDb()('directus_notifications').where('id', '>', last).first()), 10_000);
			const notifications = await hostDb()('directus_notifications')
				.select('subject', 'message', 'collection', 'item', 'status')
				.where('id', '>', last);

			return {
				res: snap(res, '/utils'),
				rows: await rows(),
				notifications: comparable(notifications, { admin: adminId }),
			};
		});

		assertSameTranscripts(transcripts, 'background import');
		expect((transcripts.backoffice as any).notifications).toHaveLength(1);
	});

	it('the concurrent import counter is one Redis key for both apps (IMPORT_MAX_CONCURRENCY = 20)', async () => {
		const body = file(CSV, 'text/csv', 'books.csv');
		const headers = { ...(await admin()), ...body.headers };

		// Set as Directus sets it: a number value in the namespace of IMPORT_EXPORT_NAMESPACE (directus:import-export).
		await redis().set(COUNTER, '20');

		try {
			for (const app of ['directus', 'backoffice'] as AppName[]) {
				const res = await capture(urls()[app], {
					method: 'POST',
					path: `/utils/import/${BOOKS}`,
					headers,
					body: body.body,
				});
				expect(res.status, app).toBe(403); // LimitExceededError is a 403 in @directus/errors
				expect((res.json as any).errors[0].extensions.code, app).toBe('LIMIT_EXCEEDED');
			}
		} finally {
			await redis().set(COUNTER, '0');
		}

		await empty();
		const res = await capture(urls().backoffice, {
			method: 'POST',
			path: `/utils/import/${BOOKS}`,
			headers,
			body: body.body,
		});
		expect(res.status).toBe(200);
		expect(await redis().get(COUNTER)).toBe('0');
	});
});

describe.runIf(full)('POST /utils/export/:collection', () => {
	const formats = ['csv', 'csv_utf8', 'json', 'xml', 'yaml'] as const;

	/** Exports at `app`, waits for the file row, returns it with the bytes read through /assets at both apps. */
	async function exportAt(app: AppName, body: Record<string, unknown>) {
		const before = new Set((await hostDb()('directus_files').select('id')).map((r) => r.id));
		const res = await capture(urls()[app], {
			method: 'POST',
			path: `/utils/export/${BOOKS}`,
			headers: await admin(),
			body,
		});

		// Files run one after the other: the only new file row is the export, complete once the upload set its size.
		let row: Record<string, any> | undefined;
		await until(async () => {
			row = (await hostDb()('directus_files').select('*')).find((r) => !before.has(r.id));
			return Boolean(row && row['filesize'] !== null && row['filename_disk'] !== null);
		}, 15_000);

		if (!row) return { status: res.status, row: null, bytes: [] };

		const bytes = await Promise.all(
			(['directus', 'backoffice'] as AppName[]).map(async (reader) =>
				Buffer.from(
					await (
						await fetch(new URL(`/assets/${row!['id']}?download`, urls()[reader]), { headers: await admin() })
					).arrayBuffer(),
				),
			),
		);

		// getDateTimeFormatted of @directus/utils: hours, minutes, seconds are not padded (20261013-22357).
		const time = /\d{8}-\d{3,6}/g;
		const comparableRow = {
			...comparable(row, { file: row['id'] }),
			title: String(row['title']).replace(time, '<time>'),
			filename_download: String(row['filename_download']).replace(time, '<time>'),
		};

		return { status: res.status, row: comparableRow, bytes };
	}

	it.each(formats)('%s: same file row, same bytes; the bytes read the same at both apps', async (format) => {
		await empty();
		await appRequest('directus', 'POST', `/items/${BOOKS}`, [
			{ title: 'Dune', pages: 412, meta: { a: 1 } },
			{ title: 'Emma', pages: 320 },
			{ title: 'Beloved', pages: 324 },
		]);

		const query = { fields: ['title', 'pages', 'meta'], sort: ['title'], limit: -1 };
		const directus = await exportAt('directus', { query, format });
		const backoffice = await exportAt('backoffice', { query, format });

		expect(backoffice.status).toBe(204);
		expect(backoffice.row).toEqual(directus.row);
		expect(directus.bytes[0]!.equals(directus.bytes[1]!), 'Directus file read at both apps').toBe(true);
		expect(backoffice.bytes[0]!.equals(directus.bytes[0]!), `${format} bytes`).toBe(true);
	});

	it('an empty collection, a limit, a filter and the file title override', async () => {
		await empty();
		const emptyD = await exportAt('directus', { query: { limit: -1 }, format: 'json' });
		const emptyB = await exportAt('backoffice', { query: { limit: -1 }, format: 'json' });
		expect(emptyB.row).toEqual(emptyD.row);
		expect(emptyB.bytes[0]!.equals(emptyD.bytes[0]!)).toBe(true);

		await appRequest('directus', 'POST', `/items/${BOOKS}`, [
			{ title: 'A', pages: 1 },
			{ title: 'B', pages: 2 },
			{ title: 'C', pages: 3 },
		]);
		const body = {
			query: { fields: ['title'], filter: { pages: { _gte: 2 } }, sort: ['-title'], limit: 1 },
			format: 'csv',
			file: { title: 'Parity export', filename_download: `parity-${run}.csv` },
		};
		const d = await exportAt('directus', body);
		const b = await exportAt('backoffice', body);
		expect(b.row).toEqual(d.row);
		expect(b.bytes[0]!.equals(d.bytes[0]!)).toBe(true);
	});

	it('missing query or format, unknown collection: same errors', async () => {
		const headers = await admin();
		await same({ method: 'POST', path: `/utils/export/${BOOKS}`, headers, body: { format: 'csv' } });
		await same({ method: 'POST', path: `/utils/export/${BOOKS}`, headers, body: { query: {} } });
		await same({ method: 'POST', path: '/utils/export/nope_collection', headers, body: { query: {}, format: 'csv' } });
	});
});
