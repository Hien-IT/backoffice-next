// Feature 010, US4 (spec FR-040 to FR-046, contracts/system-api.md §3): /shares at both apps. Each scenario runs at
// Directus, then at Backoffice, with shares of its own; the responses, the share and session rows and the token claims
// are compared. Tokens issued at one app are used at the other. Mail invitations are warning lines at Backoffice
// (D-36). R-25 (one use more than max_uses), R-27 (public routes) and R-29 (missing password → 500) are measured.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { urls } from '../auth/fixtures.js';
import { assertSameTranscripts, type ScenarioContext, scenario } from '../auth/scenario.js';
import { type AppName, appRequest } from '../directus-api.js';
import { cleanupFlows, seedFlow, settled } from '../flows/helpers.js';
import { capture, type Captured } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, call, comparable, jwtPayload, same, snap, systemEffects, verifyHashAt, warnLines } from './helpers.js';

const run = Math.random().toString(16).slice(2, 10);
const POSTS = `parity_sh_${run}`;
const full = process.env['PARITY_SUITE'] !== 'reduced';

let item: number;
let otherItem: number;
let shareRole: string;
let sharer: TestUser; // app access, read and share on POSTS
let reader: TestUser; // app access, read on POSTS only
const flows: string[] = [];

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });

beforeAll(async () => {
	await appRequest('directus', 'POST', '/collections', {
		collection: POSTS,
		schema: {},
		meta: { hidden: true },
		fields: [
			{
				field: 'id',
				type: 'integer',
				meta: { hidden: true },
				schema: { is_primary_key: true, has_auto_increment: true },
			},
			{ field: 'title', type: 'string', meta: {} },
		],
	});
	item = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'shared' })).data.id;
	otherItem = (await appRequest('directus', 'POST', `/items/${POSTS}`, { title: 'not shared' })).data.id;

	const read = { collection: POSTS, action: 'read' as const, fields: ['*'], permissions: {} };
	const sharing = await createPolicy('directus', 'sh-sharer', {
		app: true,
		permissions: [
			read,
			{ collection: POSTS, action: 'share' as const, fields: ['*'], permissions: {} },
			// Creating a share is also a create on directus_shares (the app minimal permissions only read it).
			{ collection: 'directus_shares', action: 'create' as const, fields: ['*'], permissions: {} },
		],
	});
	const reading = await createPolicy('directus', 'sh-reader', { app: true, permissions: [read] });
	const roleReading = await createPolicy('directus', 'sh-role', { permissions: [read] });

	shareRole = (await appRequest('directus', 'POST', '/roles', { name: `sh-role-${run}`, icon: 'share' })).data.id;
	await attachPolicy('directus', roleReading, { role: shareRole });

	sharer = await createUser('directus', 'sh-sharer', { first_name: 'Sam', last_name: 'Sharer' } as any);
	reader = await createUser('directus', 'sh-reader');
	await attachPolicy('directus', sharing, { user: sharer.id });
	await attachPolicy('directus', reading, { user: reader.id });
}, 300_000);

afterAll(async () => {
	await hostDb()('directus_shares').where({ collection: POSTS }).delete();
	await cleanupFlows(flows);
	await appRequest('directus', 'DELETE', `/collections/${POSTS}`);
	await appRequest('directus', 'DELETE', `/roles/${shareRole}`).catch(() => undefined);
	await cleanup();
	await closeHostDb();
}, 120_000);

/** A share of `item` written straight in the database (the same row for each run), its id. */
async function share(data: Record<string, unknown> = {}): Promise<string> {
	const id = crypto.randomUUID();
	await hostDb()('directus_shares').insert({
		id,
		name: 'parity',
		collection: POSTS,
		item: String(item),
		role: shareRole,
		user_created: sharer.id,
		times_used: 0,
		...data,
	});
	return id;
}

const shareRow = async (id: string) =>
	hostDb()('directus_shares').select('times_used', 'max_uses', 'password').where({ id }).first();

/** Status, body (tokens as their claims) and cookies of a /shares/auth answer. */
function authSnapshot(res: Captured, ids: Record<string, string>) {
	const body = res.json as any;
	const data = body?.data;
	const tokens = data
		? {
				...data,
				...(data.access_token ? { access_token: jwtPayload(data.access_token) } : {}),
				...(data.refresh_token ? { refresh_token: '<token>' } : {}),
			}
		: body;
	// Each cookie as its name, its value (the claims of a JWT, `<token>` otherwise) and its attributes but Expires.
	const cookies = ([] as string[])
		.concat((res.headers['set-cookie'] as string | string[] | undefined) ?? [])
		.map((c) => {
			const [pair, ...attributes] = c.split('; ');
			const [name, value] = pair!.split('=') as [string, string];
			return {
				name,
				value: value.includes('.') ? jwtPayload(value) : '<token>',
				attributes: attributes.filter((a) => !a.startsWith('Expires=')),
			};
		});
	return comparable({ status: res.status, body: data ? { data: tokens } : body, cookies }, ids);
}

function sortData<T extends { body: unknown }>(snapshot: T): T {
	const data = (snapshot.body as { data?: { id: string }[] } | null)?.data;
	if (Array.isArray(data)) data.sort((x, y) => x.id.localeCompare(y.id));
	return snapshot;
}

const auth = (ctx: ScenarioContext, body: Record<string, unknown>) =>
	call(ctx, { method: 'POST', path: '/shares/auth', body });

describe('POST /shares: the share action, the hash and the concealed password', () => {
	it('reader without share permission: 403; sharer: row written, password hashed and concealed', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const refused = await call(ctx, {
				method: 'POST',
				path: '/shares',
				headers: bearer(reader),
				body: { collection: POSTS, item, name: 'no' },
			});

			const { result, rows } = await systemEffects(['shares'], () =>
				call(ctx, {
					method: 'POST',
					path: '/shares',
					headers: bearer(sharer),
					body: { collection: POSTS, item, name: 'mine', password: 'secret', max_uses: 3, role: shareRole },
				}),
			);

			const id = (result.json as any)?.data?.id as string;
			const ids = { share: id, sharer: sharer.id, role: shareRole, item: String(item) };
			const hash = (rows.shares?.[0]?.['password'] as string) ?? '';

			return {
				refused: snap(refused, '/shares', ids),
				created: snap(result, '/shares', ids),
				rows: comparable(rows, ids),
				// The hash written by this app verifies at both apps.
				verified: [await verifyHashAt('directus', hash, 'secret'), await verifyHashAt('backoffice', hash, 'secret')],
				read: snap(await call(ctx, { path: `/shares/${id}`, headers: await admin() }), '/shares', ids),
			};
		});

		assertSameTranscripts(transcripts, 'POST /shares');
		expect(transcripts.backoffice.verified).toEqual([true, true]);
	});
});

describe('POST /shares/auth', () => {
	it.each(['json', 'cookie', 'session'])(
		'%s mode: answer, cookie, session row, times_used, JWT claims',
		async (mode) => {
			const transcripts = await scenario(urls(), async (ctx) => {
				const id = await share();
				const ids = { share: id };
				const { result, rows } = await systemEffects(['sessions'], () => auth(ctx, { share: id, mode }));
				return { res: authSnapshot(result, ids), sessions: comparable(rows, ids), row: comparable(await shareRow(id)) };
			});

			assertSameTranscripts(transcripts, `share login ${mode}`);
			expect((transcripts.backoffice as any).res.status).toBe(200);
		},
	);

	it('refused logins: unknown, ended, not started, used up, wrong password; bad payloads', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const ended = await share({ date_end: new Date(Date.now() - 60_000) });
			const notStarted = await share({ date_start: new Date(Date.now() + 3_600_000) });
			const usedUp = await share({ max_uses: 1, times_used: 2 });
			const withPassword = await share({
				password: (await appRequest('directus', 'POST', '/utils/hash/generate', { string: 'pw' })).data,
			});
			const ids = { ended, notStarted, usedUp, withPassword };

			const cases = {
				unknown: await auth(ctx, { share: crypto.randomUUID() }),
				ended: await auth(ctx, { share: ended }),
				notStarted: await auth(ctx, { share: notStarted }),
				usedUp: await auth(ctx, { share: usedUp }),
				wrongPassword: await auth(ctx, { share: withPassword, password: 'bad' }),
				rightPassword: await auth(ctx, { share: withPassword, password: 'pw' }),
				noShare: await auth(ctx, { password: 'pw' }),
				badMode: await auth(ctx, { share: withPassword, mode: 'other' }),
				extraKeys: await auth(ctx, { share: ended, extra: true }),
			};

			return Object.fromEntries(Object.entries(cases).map(([name, res]) => [name, authSnapshot(res, ids)]));
		});

		assertSameTranscripts(transcripts, 'refused share logins');
		expect((transcripts.backoffice as any).ended.status).toBe(401);
		expect((transcripts.backoffice as any).rightPassword.status).toBe(200);
	});

	it('R-25: max_uses = 1 logs in twice, the third time is refused (measured on Directus)', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const id = await share({ max_uses: 1 });
			const statuses = [];
			for (let i = 0; i < 3; i++) statuses.push((await auth(ctx, { share: id })).status);
			return { statuses, row: comparable(await shareRow(id)) };
		});

		assertSameTranscripts(transcripts, 'R-25');
		expect(transcripts.directus.statuses).toEqual([200, 200, 401]);
	});

	it('R-29: a share with a password and no password in the payload → the same 500 at both apps', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const id = await share({
				password: (await appRequest('directus', 'POST', '/utils/hash/generate', { string: 'pw' })).data,
			});
			const res = await auth(ctx, { share: id });
			return {
				status: res.status,
				code: (res.json as any)?.errors?.[0]?.extensions?.code,
				row: comparable(await shareRow(id)),
			};
		});

		assertSameTranscripts(transcripts, 'R-29');
		process.stdout.write(`R-29 measured: ${JSON.stringify(transcripts.directus)}\n`);
	});

	it('expired sessions of everyone are removed by a share login, at both apps', async () => {
		for (const app of ['directus', 'backoffice'] as AppName[]) {
			const token = `parity-expired-${run}-${app}`.padEnd(64, 'x');
			await hostDb()('directus_sessions').insert({ token, expires: new Date(Date.now() - 60_000), user: reader.id });
			const res = await capture(urls()[app], { method: 'POST', path: '/shares/auth', body: { share: await share() } });
			expect(res.status, app).toBe(200);
			expect(await hostDb()('directus_sessions').where({ token }).first(), app).toBeUndefined();
		}
	});
});

describe('tokens of a share across the apps (FR-042)', () => {
	const pairs: [AppName, AppName][] = [
		['directus', 'backoffice'],
		['backoffice', 'directus'],
	];

	it.each(pairs)(
		'issued at %s, used at %s: the shared item yes, another item and collection no; refresh',
		async (issuer, consumer) => {
			const id = await share();
			const login = await capture(urls()[issuer], { method: 'POST', path: '/shares/auth', body: { share: id } });
			const { access_token: token, refresh_token: refresh } = (login.json as any).data;
			const headers = { authorization: `Bearer ${token}` };

			const read = await capture(urls()[consumer], { path: `/items/${POSTS}/${item}`, headers });
			expect(read.status).toBe(200);
			expect((read.json as any).data.title).toBe('shared');
			expect((await capture(urls()[consumer], { path: `/items/${POSTS}/${otherItem}`, headers })).status).toBe(403);
			expect((await capture(urls()[consumer], { path: '/users', headers })).status).toBe(403);

			await same({ path: `/items/${POSTS}/${item}`, headers });
			await same({ path: `/items/${POSTS}?fields=id,title`, headers });

			const refreshed = await capture(urls()[consumer], {
				method: 'POST',
				path: '/auth/refresh',
				body: { refresh_token: refresh },
			});
			expect(refreshed.status).toBe(200);
			expect(jwtPayload((refreshed.json as any).data.access_token)).toMatchObject({ share: id, role: null });
		},
	);

	it('a share deleted at one app: its token is refused at the other (permissions cache cleared)', async () => {
		for (const [writer, consumer] of pairs) {
			const id = await share();
			const login = await capture(urls()[consumer], { method: 'POST', path: '/shares/auth', body: { share: id } });
			const headers = { authorization: `Bearer ${(login.json as any).data.access_token}` };

			expect((await capture(urls()[consumer], { path: `/items/${POSTS}/${item}`, headers })).status).toBe(200);
			await appRequest(writer, 'DELETE', `/shares/${id}`);
			expect(
				(await capture(urls()[consumer], { path: `/items/${POSTS}/${item}`, headers })).status,
				`${writer}→${consumer}`,
			).not.toBe(200);
		}
	});
});

describe('GET /shares/info/:pk and the other reads (R-27)', () => {
	it('public reads of a live share, an ended one, a wrong id, a non-uuid', async () => {
		const live = await share({ password: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2g', max_uses: 5 });
		const ended = await share({ date_end: new Date(Date.now() - 60_000) });

		await same({ path: `/shares/info/${live}` });
		await same({ path: `/shares/info/${live.toUpperCase()}` });
		await same({ path: `/shares/info/${ended}` });
		await same({ path: `/shares/info/${crypto.randomUUID()}` });
		await same({ path: '/shares/info/not-a-uuid' });
		await same({ path: '/shares/not-a-uuid', headers: await admin() });
	});

	it('list as admin and as the sharer (own shares only), OPTIONS', async () => {
		await same({
			path: `/shares?filter[collection][_eq]=${POSTS}&filter[name][_eq]=parity&fields=id,item,collection&sort=id`,
			headers: await admin(),
		});
		await same({ path: `/shares?filter[collection][_eq]=${POSTS}&fields=id`, headers: bearer(sharer) });
		await same({ path: '/shares' });
		await same({ method: 'OPTIONS', path: '/shares/auth' });
		await same({ method: 'OPTIONS', path: `/shares/info/${crypto.randomUUID()}` });
		await same({ method: 'OPTIONS', path: '/shares/not-a-uuid' });
	});
});

describe('POST /shares/invite (FR-044, D-36)', () => {
	it('same answers at both apps; one warning line per address at Backoffice, no mail', async () => {
		const id = await share();
		const before = warnLines('backoffice-api', 'share invitation');

		await same(
			{
				method: 'POST',
				path: '/shares/invite',
				headers: bearer(sharer),
				body: { share: id, emails: ['a@example.com', 'b@example.com'] },
			},
			{ sequential: true },
		);
		expect(warnLines('backoffice-api', 'share invitation') - before).toBe(2);

		await same({ method: 'POST', path: '/shares/invite', body: { share: id, emails: ['a@example.com'] } });
		await same({
			method: 'POST',
			path: '/shares/invite',
			headers: bearer(reader),
			body: { share: id, emails: ['a@example.com'] },
		});
		await same({
			method: 'POST',
			path: '/shares/invite',
			headers: bearer(sharer),
			body: { emails: ['a@example.com'] },
		});
		await same({
			method: 'POST',
			path: '/shares/invite',
			headers: bearer(sharer),
			body: { share: crypto.randomUUID(), emails: [] },
		});
	});
});

describe('updates and deletes as scenarios', () => {
	it('batch update, update one, delete by keys; DELETE / without keys or query', async () => {
		const transcripts = await scenario(urls(), async (ctx) => {
			const headers = await admin();
			const a = await share();
			const b = await share();
			const ids = { a, b };

			return {
				// readMany answers uuids in a random order at both apps: sorted by placeholder.
				batch: sortData(
					snap(
						await call(ctx, {
							method: 'PATCH',
							path: '/shares?fields=id,max_uses',
							headers,
							body: { keys: [a, b], data: { max_uses: 9 } },
						}),
						'/shares',
						ids,
					),
				),
				one: snap(
					await call(ctx, { method: 'PATCH', path: `/shares/${a}?fields=id,name`, headers, body: { name: 'renamed' } }),
					'/shares',
					ids,
				),
				nonUuid: snap(
					await call(ctx, { method: 'PATCH', path: '/shares/abc', headers, body: { name: 'x' } }),
					'/shares',
					ids,
				),
				empty: snap(await call(ctx, { method: 'DELETE', path: '/shares', headers, body: {} }), '/shares', ids),
				deleted: snap(await call(ctx, { method: 'DELETE', path: '/shares', headers, body: [a, b] }), '/shares', ids),
				left: await hostDb()('directus_shares').whereIn('id', [a, b]).count({ n: '*' }).first(),
			};
		});

		assertSameTranscripts(transcripts, 'share updates');
	});
});

describe.runIf(full)('the shares.create filter of a flow (FR-004)', () => {
	it('a throw-error filter blocks POST /shares with the same error at both apps', async () => {
		const { id } = await seedFlow({
			trigger: 'event',
			options: { type: 'filter', scope: ['items.create'], collections: ['directus_shares'] },
			operations: [
				{ key: 'stop', type: 'throw-error', options: { code: 'NO_SHARES', status: '400', message: 'no shares' } },
			],
		});
		flows.push(id, await settled());

		await same(
			{ method: 'POST', path: '/shares', headers: bearer(sharer), body: { collection: POSTS, item, name: 'blocked' } },
			{ sequential: true },
		);
		expect(await hostDb()('directus_shares').where({ name: 'blocked' }).first()).toBeUndefined();
		await cleanupFlows(flows.splice(0));
	});
});
