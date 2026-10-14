// Feature 010, US8 (spec FR-070 to FR-072, contracts/system-api.md §4, D-37): /extensions at both apps. Reads, the
// empty app bundle (byte for byte) and the registry browse through the fake registry are the same; install,
// reinstall, uninstall, PATCH and DELETE /:pk keep the checks of Directus, then the new app refuses (503 or 403)
// where Directus answers 503 "Could not download the extension" or 204 (measured 2026-10-14 on Directus 11.17.4).
// Directus writes the directus_extensions row before it downloads, so its failed install leaves the row (its uninstall
// removes it); the new app writes nothing.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { parity } from '../parity.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { admin, same } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';

const EXTENSION = 'e0000000-0000-4000-8000-000000000001'; // tests/parity/registry/fixtures
const VERSION = 'e0000000-0000-4000-8000-00000000000a';
const ACCOUNT = 'a1b2c3d4-0000-4000-8000-000000000001';
const UNKNOWN = 'a1b2c3d4-0000-4000-8000-0000000000ff';

let appUser: TestUser;

const bearer = (user: TestUser) => ({ authorization: `Bearer ${user.token}` });
const rows = async () => Number((await hostDb()('directus_extensions').count({ n: '*' }))[0]!['n']);

beforeAll(async () => {
	const appPolicy = await createPolicy('directus', 'extensions-app', { app: true });
	appUser = await createUser('directus', 'extensions-app');
	await attachPolicy('directus', appPolicy, { user: appUser.id });
}, 300_000);

afterAll(async () => {
	await cleanup();
	await closeHostDb();
}, 120_000);

describe('reads at both apps', () => {
	it('GET /extensions as admin, as an app access user, public; OPTIONS', async () => {
		await same({ path: '/extensions', headers: await admin() });
		await same({ path: '/extensions', headers: bearer(appUser) });
		await same({ path: '/extensions' });
		await same({ method: 'OPTIONS', path: '/extensions' });
	});

	it('the empty app bundle: same bytes and headers, a request that skips the cache, another chunk → 404', async () => {
		const bundle = await same({ path: '/extensions/sources/index.js' });
		expect(bundle.backoffice.status).toBe(200);
		expect(bundle.backoffice.headers['transfer-encoding']).toBe('chunked');

		await same({ path: '/extensions/sources/index.js', headers: { 'cache-control': 'no-store' } });
		await same({ method: 'HEAD', path: '/extensions/sources/index.js' });
		await same({ path: '/extensions/sources/other.js' });
		await same({ method: 'OPTIONS', path: '/extensions/sources/index.js' });
	});
});

describe.runIf(full)('the registry through the fake registry', () => {
	it('list: no query, search, type, a type that is not an extension type, sort, limit and offset; non-admin', async () => {
		const headers = await admin();

		for (const query of [
			'',
			'?search=color',
			'?filter[type][_eq]=display',
			'?filter[type][_eq]=widget',
			'?filter[by][_eq]=parity-alice',
			'?sort=popular&limit=2&offset=1',
			'?sort=recent',
		])
			await same({ path: `/extensions/registry${query}`, headers });

		await same({ path: '/extensions/registry', headers: bearer(appUser) });
		await same({ path: '/extensions/registry' });
	});

	it('account and extension: a fixture, an unknown id (503 with the same reason), not a uuid (404), non-admin', async () => {
		const headers = await admin();

		await same({ path: `/extensions/registry/account/${ACCOUNT}`, headers });
		await same({ path: `/extensions/registry/account/${UNKNOWN}`, headers });
		await same({ path: `/extensions/registry/extension/${EXTENSION}`, headers });
		await same({ path: `/extensions/registry/extension/${UNKNOWN}`, headers });
		await same({ path: '/extensions/registry/extension/xyz', headers });
		await same({ path: `/extensions/registry/account/${ACCOUNT}`, headers: bearer(appUser) });
		await same({ method: 'OPTIONS', path: `/extensions/registry/extension/${EXTENSION}` });
	});
});

describe.runIf(full)('install, uninstall, enable: the checks of Directus, then D-37', () => {
	it('the same 403 and 404 before the action; then Directus 503 or 204, the new app 503 or 403', async () => {
		const headers = { ...(await admin()), 'content-type': 'application/json' };
		await hostDb()('directus_extensions').where({ id: EXTENSION }).delete();
		const before = await rows();

		// Checks that run before the action: same answer.
		await same({ method: 'POST', path: '/extensions/registry/install', headers, body: {} });
		await same({ method: 'POST', path: '/extensions/registry/reinstall', headers, body: {} });
		await same({
			method: 'POST',
			path: '/extensions/registry/install',
			headers: bearer(appUser),
			body: { extension: EXTENSION, version: VERSION },
		});
		await same({ method: 'DELETE', path: '/extensions/registry/uninstall/xyz', headers });
		await same({ method: 'PATCH', path: '/extensions/xyz', headers, body: {} });
		await same({ method: 'DELETE', path: `/extensions/${EXTENSION}`, headers: bearer(appUser) });

		// The action itself (D-37), with the rows of directus_extensions after it (only Directus writes).
		for (const [req, directus, backoffice, added] of [
			[
				{ method: 'POST', path: '/extensions/registry/install', body: { extension: EXTENSION, version: VERSION } },
				503,
				503,
				1,
			],
			[{ method: 'POST', path: '/extensions/registry/reinstall', body: { extension: EXTENSION } }, 503, 503, 1],
			[{ method: 'DELETE', path: `/extensions/registry/uninstall/${EXTENSION}` }, 204, 503, 0],
			[{ method: 'PATCH', path: `/extensions/${EXTENSION}`, body: { meta: { enabled: false } } }, 204, 403, 0],
			[{ method: 'DELETE', path: `/extensions/${EXTENSION}` }, 204, 403, 0],
		] as const) {
			const result = await parity({ ...req, headers });
			expect(result.directus.status, `${req.method} ${req.path}`).toBe(directus);
			expect(result.backoffice.status, `${req.method} ${req.path}`).toBe(backoffice);
			expect(await rows(), `rows after ${req.method} ${req.path}`).toBe(before + added);

			if (backoffice === 503) {
				expect((result.backoffice.json as any).errors[0].extensions).toEqual({
					service: 'marketplace',
					reason: 'Backoffice does not install extensions',
					code: 'SERVICE_UNAVAILABLE',
				});
			}
		}

		expect(await rows()).toBe(before);
	});
});
