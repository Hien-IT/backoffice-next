// Spec 031 (FR-022, contracts/tests.md §2): install an extension from an uploaded npm-pack tarball at the main pair
// (Directus 8155, Backoffice 8156, the second Backoffice 8157 of profile `multi`; one database, one storage location).
// The route exists at Backoffice only (D-212, Directus 404); an uploaded package runs on every Backoffice node and never
// at Directus, which lists its row with `schema: null` (D-212.1, D-212.2); every rejected package leaves no row and no
// folder; uninstall accepts the `upload` source at Backoffice only (D-212.3); two nodes uploading the same name at once:
// one wins. The packages are the committed tarballs of tests/fixtures/extensions (parity-upload-*: never seeded).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { attachPolicy, cleanup, createPolicy, createUser } from '../permissions/fixtures.js';
import { admin, extRows, mc, nodes, waitAll } from './helpers.js';

const FIXTURES = fileURLToPath(new URL('../../../fixtures/extensions/', import.meta.url));
const tgz = (name: string) => readFileSync(join(FIXTURES, name, `${name}-1.0.0.tgz`));

const directus = () => nodes().find((node) => node.name === 'directus')!;
const backoffice = () => nodes().find((node) => node.name === 'backoffice')!;
const backofficeNodes = () => nodes().filter((node) => node.name !== 'directus');

let work: string;
const installed: string[] = [];

beforeAll(() => {
	work = mkdtempSync(join(tmpdir(), 'parity-upload-'));
});

afterAll(async () => {
	// A test cut short leaves its rows and folders: remove them, then wait for every node to serve the seeded fixtures.
	if (installed.length > 0) {
		await hostDb()('directus_extensions').whereIn('id', installed).orWhereIn('bundle', installed).delete();
		for (const id of installed) mc(`mc rm --recursive --force local/directus/extensions/.upload/${id} || true`);
	}
	await waitAll(async () => {
		for (const node of nodes()) {
			const res = await fetch(`${node.url}/parity-endpoint-demo`);
			if (res.status !== 200) throw new Error(`${node.name} /parity-endpoint-demo: ${res.status}`);
		}
	}, 30_000);
	rmSync(work, { recursive: true, force: true });
	await closeHostDb();
});

async function upload(url: string, file: Buffer, name: string, headers?: Record<string, string>) {
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(file)]), name);
	const res = await fetch(`${url}/backoffice/extensions/upload`, {
		method: 'POST',
		headers: headers ?? (await admin()),
		body: form,
	});
	const text = await res.text();
	const json = text ? JSON.parse(text) : null;
	if (res.status === 200) installed.push(json.data.id);
	return { status: res.status, json };
}

async function call(url: string, method: string, path: string, body?: unknown) {
	const res = await fetch(`${url}${path}`, {
		method,
		headers: { ...(await admin()), 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** Every Backoffice node answers `path` with `status` (10 s), and Directus answers 404. */
const onBackofficeOnly = (path: string, status: number) =>
	waitAll(async () => {
		for (const node of nodes()) {
			const expected = node.name === 'directus' ? 404 : status;
			const res = await fetch(`${node.url}${path}`);
			if (res.status !== expected) throw new Error(`${node.name} ${path}: ${res.status}, expected ${expected}`);
		}
	});

/** The folders under extensions/.upload/ of the shared storage. */
const uploadFolders = () =>
	mc('mc ls local/directus/extensions/.upload/ 2>/dev/null || true')
		.split('\n')
		.map((line) => line.trim().split(/\s+/).pop()!.replace(/\/$/, ''))
		.filter(Boolean)
		.sort();

/** The file names under extensions/.upload/<id>/ of the shared storage. */
const stored = (id: string) =>
	mc(`mc ls --recursive local/directus/extensions/.upload/${id}/ 2>/dev/null || true`)
		.split('\n')
		.map((line) => line.trim().split(/\s+/).pop()!)
		.filter(Boolean)
		.sort();

async function extensionsOf(url: string) {
	return ((await call(url, 'GET', '/extensions')).json?.data ?? []) as {
		id: string;
		bundle: string | null;
		meta: { source: string };
		schema: { type?: string } | null;
	}[];
}

/** The app bundle of a node: its entry chunk and every chunk it imports. */
async function appBundle(url: string): Promise<string> {
	const headers = await admin();
	const entry = await (await fetch(`${url}/extensions/sources/index.js`, { headers })).text();
	const chunks = [...entry.matchAll(/["']\.\/([\w.-]+\.js)["']/g)].map((match) => match[1]!);
	const rest = await Promise.all(
		chunks.map(async (chunk) => (await fetch(`${url}/extensions/sources/${chunk}`, { headers })).text()),
	);
	return [entry, ...rest].join('\n');
}

describe('upload an npm-pack tarball', () => {
	let endpointId: string;
	let bundleId: string;

	it('D-212: the route is Backoffice only; GET answers the size limit', async () => {
		expect((await call(directus().url, 'GET', '/backoffice/extensions/upload')).status).toBe(404);
		expect((await upload(directus().url, tgz('parity-upload-endpoint'), 'x.tgz')).status).toBe(404);

		const limits = await call(backoffice().url, 'GET', '/backoffice/extensions/upload');
		expect(limits.status).toBe(200);
		expect(limits.json.data).toHaveProperty('max_upload_size');
	});

	it('an endpoint package: 200 with its row; it runs on every Backoffice node, never at Directus', async () => {
		const res = await upload(backoffice().url, tgz('parity-upload-endpoint'), 'parity-upload-endpoint-1.0.0.tgz');

		expect(res.status, JSON.stringify(res.json)).toBe(200);
		expect(res.json.data).toMatchObject({
			bundle: null,
			meta: { source: 'upload', enabled: true, bundle: null },
			schema: { type: 'endpoint', name: 'parity-upload-endpoint' },
		});
		endpointId = res.json.data.id;
		expect(res.json.data.meta.folder).toBe(endpointId);

		await onBackofficeOnly('/parity-upload-endpoint', 200);
		expect(await (await fetch(`${backoffice().url}/parity-upload-endpoint`)).json()).toEqual({
			ok: true,
			source: 'upload',
		});

		expect((await extRows()).filter((row) => row.id === endpointId)).toEqual([
			{ id: endpointId, enabled: true, folder: endpointId, source: 'upload', bundle: null },
		]);
		expect(stored(endpointId)).toEqual(expect.arrayContaining(['package.json', 'dist/index.js']));
	});

	it('D-212.1, D-212.2: GET /extensions lists the row with its schema at Backoffice, schema null at Directus', async () => {
		const atDirectus = (await extensionsOf(directus().url)).find((row) => row.id === endpointId);
		const atBackoffice = (await extensionsOf(backoffice().url)).find((row) => row.id === endpointId);

		expect(atDirectus).toMatchObject({ meta: { source: 'upload' }, schema: null });
		expect(atBackoffice).toMatchObject({ meta: { source: 'upload' }, schema: { type: 'endpoint' } });
	});

	it('disabling and enabling it at either app reaches every Backoffice node (FR-012)', async () => {
		const disable = async (url: string, enabled: boolean) => {
			const res = await call(url, 'PATCH', `/extensions/${endpointId}`, { meta: { enabled } });
			expect([200, 204], JSON.stringify(res.json)).toContain(res.status);
		};

		await disable(backoffice().url, false);
		await onBackofficeOnly('/parity-upload-endpoint', 404);
		await disable(backoffice().url, true);
		await onBackofficeOnly('/parity-upload-endpoint', 200);

		// Directus updates the row and tells the other nodes to reload (shared bus channel).
		await disable(directus().url, false);
		await onBackofficeOnly('/parity-upload-endpoint', 404);
		await disable(backoffice().url, true);
		await onBackofficeOnly('/parity-upload-endpoint', 200);
	}, 120_000);

	it('an app-only bundle: one row per entry; its interface is in the app bundle of Backoffice only', async () => {
		const res = await upload(backoffice().url, tgz('parity-upload-bundle'), 'parity-upload-bundle-1.0.0.tgz');

		expect(res.status, JSON.stringify(res.json)).toBe(200);
		expect(res.json.data.schema).toMatchObject({ type: 'bundle', name: 'parity-upload-bundle' });
		bundleId = res.json.data.id;

		const entries = (await extRows())
			.filter((row) => row.bundle === bundleId)
			.map((row) => ({ folder: row.folder, source: row.source, enabled: row.enabled }))
			.sort((a, b) => a.folder.localeCompare(b.folder));
		expect(entries).toEqual([
			{ folder: 'upload-display', source: 'upload', enabled: true },
			{ folder: 'upload-iface', source: 'upload', enabled: true },
		]);

		await waitAll(async () => {
			expect(await appBundle(backoffice().url)).toContain('Upload Bundle Interface');
		}, 30_000);
		expect(await appBundle(directus().url)).not.toContain('Upload Bundle Interface');

		// Directus drops the entries of a bundle whose schema is null.
		expect((await extensionsOf(directus().url)).filter((row) => row.id === bundleId || row.bundle === bundleId)).toEqual(
			[expect.objectContaining({ id: bundleId, schema: null })],
		);
	}, 120_000);

	it('rejected packages: the reason, no row, no folder (FR-002, FR-004, FR-006, FR-007)', async () => {
		const rowsBefore = (await extRows()).length;
		const foldersBefore = uploadFolders();

		const notTar = await upload(
			backoffice().url,
			readFileSync(join(FIXTURES, 'parity-upload-endpoint', 'package.json')),
			'package.json',
		);
		expect(notTar.status).toBe(400);
		expect(notTar.json.errors[0].extensions.reason).toBe('The file is not a gzipped tar archive');

		const other = join(work, 'other');
		mkdirSync(other, { recursive: true });
		writeFileSync(join(other, 'package.json'), '{"name":"no-package-folder"}');
		execFileSync('tar', ['-czf', join(work, 'other.tgz'), '-C', work, 'other']);
		const noPackage = await upload(backoffice().url, readFileSync(join(work, 'other.tgz')), 'other.tgz');
		expect(noPackage.status).toBe(400);
		expect(noPackage.json.errors[0].extensions.reason).toBe(
			'package/package.json is missing (npm pack layout expected)',
		);

		// MARKETPLACE_TRUST=sandbox (the default): an endpoint without sandbox, a bundle with a hook entry.
		for (const name of ['parity-endpoint-demo', 'parity-bundle-tools']) {
			const res = await upload(backoffice().url, tgz(name), `${name}-1.0.0.tgz`);
			expect(res.status, name).toBe(400);
			expect(res.json.errors[0].extensions.reason, name).toBe(
				'MARKETPLACE_TRUST=sandbox requires a sandboxed extension',
			);
		}

		// Same name as a fixture loaded from the storage as a local extension.
		const clash = await upload(backoffice().url, tgz('parity-endpoint-sandbox'), 'parity-endpoint-sandbox-1.0.0.tgz');
		expect(clash.status).toBe(400);
		expect(clash.json.errors[0].extensions.reason).toBe(
			'An extension named "parity-endpoint-sandbox" is already installed (local)',
		);

		// Same name as the package uploaded above.
		const again = await upload(backoffice().url, tgz('parity-upload-endpoint'), 'parity-upload-endpoint-1.0.0.tgz');
		expect(again.status).toBe(400);
		expect(again.json.errors[0].extensions.reason).toBe(
			'An extension named "parity-upload-endpoint" is already installed (upload)',
		);

		expect((await extRows()).length).toBe(rowsBefore);
		expect(uploadFolders()).toEqual(foldersBefore);
	});

	it('D-212.3: uninstall of the upload source at Backoffice only; reinstall refused; a bundle entry refused', async () => {
		const atDirectus = await call(directus().url, 'DELETE', `/extensions/registry/uninstall/${endpointId}`);
		expect(atDirectus.status).toBe(400);
		expect(atDirectus.json.errors[0].extensions.reason).toBe(
			'Cannot uninstall extensions that were not installed via marketplace',
		);

		const reinstall = await call(backoffice().url, 'POST', '/extensions/registry/reinstall', { extension: endpointId });
		expect(reinstall.status).toBe(400);
		expect(reinstall.json.errors[0].extensions.reason).toBe(
			'Cannot reinstall extensions that were not installed via marketplace',
		);

		const entry = (await extRows()).find((row) => row.bundle === bundleId)!;
		const entryUninstall = await call(backoffice().url, 'DELETE', `/extensions/registry/uninstall/${entry.id}`);
		expect(entryUninstall.status).toBe(400);
		expect(entryUninstall.json.errors[0].extensions.reason).toBe('Cannot uninstall sub extensions of bundles separately');

		for (const id of [endpointId, bundleId]) {
			expect((await call(backoffice().url, 'DELETE', `/extensions/registry/uninstall/${id}`)).status).toBe(204);
			installed.splice(installed.indexOf(id), 1);
		}

		await onBackofficeOnly('/parity-upload-endpoint', 404);
		expect((await extRows()).filter((row) => [endpointId, bundleId].includes(row.id) || row.bundle === bundleId)).toEqual(
			[],
		);
		expect(stored(endpointId)).toEqual([]);
		expect(stored(bundleId)).toEqual([]);

		for (const url of [directus().url, backoffice().url]) {
			expect((await extensionsOf(url)).some((row) => row.meta.source === 'upload')).toBe(false);
		}
	}, 120_000);

	it('FR-013: two Backoffice nodes uploading the same package at once: one 200, one 400, one row', async () => {
		const [a, b] = backofficeNodes();
		const results = await Promise.all([
			upload(a!.url, tgz('parity-upload-endpoint'), 'a.tgz'),
			upload(b!.url, tgz('parity-upload-endpoint'), 'b.tgz'),
		]);

		expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
		expect(results.find((r) => r.status === 400)!.json.errors[0].extensions.reason).toBe(
			'An extension named "parity-upload-endpoint" is already installed (upload)',
		);
		expect((await extRows()).filter((row) => row.source === 'upload')).toHaveLength(1);
		expect(uploadFolders()).toHaveLength(1);

		const winner = results.find((r) => r.status === 200)!.json.data.id as string;
		await onBackofficeOnly('/parity-upload-endpoint', 200);
		expect((await call(backoffice().url, 'DELETE', `/extensions/registry/uninstall/${winner}`)).status).toBe(204);
		installed.splice(installed.indexOf(winner), 1);
		await onBackofficeOnly('/parity-upload-endpoint', 404);
	}, 120_000);

	it('a user with app access who is not an admin: 403 at Backoffice, no row', async () => {
		const policy = await createPolicy('directus', 'upload-app', { app: true });
		const user = await createUser('directus', 'upload-app');
		await attachPolicy('directus', policy, { user: user.id });
		const rowsBefore = (await extRows()).length;

		try {
			const headers = { authorization: `Bearer ${user.token}` };
			const res = await upload(backoffice().url, tgz('parity-upload-endpoint'), 'x.tgz', headers);
			expect(res.status).toBe(403);
			expect((await extRows()).length).toBe(rowsBefore);
		} finally {
			await cleanup();
		}
	}, 120_000);
});
