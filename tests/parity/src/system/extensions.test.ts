// Feature 010, US8 (spec FR-070 to FR-072, contracts/system-api.md §4, D-37): /extensions at both apps. Reads, the
// app bundle (status and headers; the body is D-137 until spec 020 wave 2) and the registry browse through the fake
// registry are the same; PATCH and DELETE /:pk are those of Directus since spec 020 wave 1; install, reinstall and
// uninstall through the fake registry since spec 020 wave 3 (D-37 lifted): one app after the other (they share the
// database and the storage), the same status and the same directus_extensions row at each.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { attachPolicy, cleanup, createPolicy, createUser, type TestUser } from '../permissions/fixtures.js';
import { nodes, waitAll } from '../extensions/helpers.js';
import { admin, same } from './helpers.js';

const full = process.env['PARITY_SUITE'] !== 'reduced';

const EXTENSION = 'e0000000-0000-4000-8000-000000000001'; // tests/parity/registry/fixtures
// The version of parity-interface-color (sandboxed: MARKETPLACE_TRUST defaults to `sandbox`, as Directus).
const VERSION = 'f0000000-0000-4000-8000-000000000001';
const ACCOUNT = 'a1b2c3d4-0000-4000-8000-000000000001';
const UNKNOWN = 'a1b2c3d4-0000-4000-8000-0000000000ff';

let appUser: TestUser;

/** Every node of the pool answers the endpoint fixture again (their reloads are done), within 30 s. */
const settled = () =>
	waitAll(async () => {
		for (const node of nodes()) {
			const res = await fetch(`${node.url}/parity-endpoint-demo`);
			if (res.status !== 200) throw new Error(`${node.name} /parity-endpoint-demo: ${res.status}`);
		}
	}, 30_000);

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

	it('the app bundle: same status and headers (body D-137 until wave 2), a request that skips the cache, another chunk → 404', async () => {
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

describe.runIf(full)('install, uninstall, enable: the checks of Directus, then the action at each app', () => {
	it('the same 403 and 404 before the action; install, reinstall, uninstall the same at each app; PATCH, DELETE the same', async () => {
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

		// The action itself, at one app then the other; each leaves the table as it found it.
		const urls = { directus: process.env['DIRECTUS_URL']!, backoffice: process.env['BACKOFFICE_URL']! };
		const call = async (url: string, method: string, path: string, body?: unknown) =>
			(
				await fetch(`${url}${path}`, {
					method,
					headers,
					...(body === undefined ? {} : { body: JSON.stringify(body) }),
				})
			).status;
		const row = async () =>
			hostDb()('directus_extensions').where({ id: EXTENSION }).first('id', 'folder', 'source', 'bundle', 'enabled');
		const seen: Record<string, unknown> = {};

		for (const [app, url] of Object.entries(urls)) {
			const install = await call(url, 'POST', '/extensions/registry/install', {
				extension: EXTENSION,
				version: VERSION,
			});
			const installed = await row();
			const reinstall = await call(url, 'POST', '/extensions/registry/reinstall', { extension: EXTENSION });
			const uninstall = await call(url, 'DELETE', `/extensions/registry/uninstall/${EXTENSION}`);
			seen[app] = { install, installed, reinstall, uninstall, after: await rows() };
		}

		expect(seen['backoffice'], JSON.stringify(seen)).toEqual(seen['directus']);
		// Each install and uninstall reloads every node (bus): wait until all serve the endpoint fixture again, so the next
		// file starts on settled nodes.
		await settled();
		expect(seen['directus']).toMatchObject({
			install: 204,
			installed: { id: EXTENSION, folder: VERSION, source: 'registry', bundle: null },
			reinstall: 204,
			uninstall: 204,
		});

		expect(await rows()).toBe(before);

		// Spec 020 wave 1: PATCH and DELETE /:pk are those of Directus (a missing row: 204 at both).
		await same({ method: 'PATCH', path: `/extensions/${EXTENSION}`, headers, body: { meta: { enabled: false } } });
		await same({ method: 'DELETE', path: `/extensions/${EXTENSION}`, headers });
		expect(await rows()).toBe(before);
	});
});
