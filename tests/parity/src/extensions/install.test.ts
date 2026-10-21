// Spec 020 US6 (FR-037 to FR-039, T173): install and uninstall through the fake registry, at Directus then at Backoffice
// (they share the database and the storage, so one after the other). Each app writes the same directus_extensions row
// and the same files under extensions/.registry/<version> of the shared S3 location (EXTENSIONS_LOCATION=s3), and
// removes both on uninstall. A non-sandboxed extension under MARKETPLACE_TRUST=sandbox (the default) cannot be
// downloaded: 503 with the same reason at both, the row written before the download is left (as Directus).
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { admin, mc, nodes } from './helpers.js';

const SANDBOXED = {
	extension: 'e0000000-0000-4000-8000-000000000001',
	version: 'f0000000-0000-4000-8000-000000000001',
};
const NOT_SANDBOXED = {
	extension: 'e0000000-0000-4000-8000-000000000006',
	version: 'f0000000-0000-4000-8000-000000000006',
};

afterAll(async () => {
	await hostDb()('directus_extensions').whereIn('id', [SANDBOXED.extension, NOT_SANDBOXED.extension]).delete();
	await closeHostDb();
});

async function call(url: string, method: string, path: string, body?: unknown) {
	const res = await fetch(`${url}${path}`, {
		method,
		headers: { ...(await admin()), 'content-type': 'application/json' },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}

/** The file names under extensions/.registry/<version>/ of the shared storage. */
const stored = (version: string) =>
	mc(`mc ls --recursive local/directus/extensions/.registry/${version}/ 2>/dev/null || true`)
		.split('\n')
		.map((line) => line.trim().split(/\s+/).pop()!)
		.filter(Boolean)
		.sort();

describe('install through the fake registry, at each app', () => {
	it('the same row and the same files; uninstall removes both', async () => {
		const seen: Record<string, unknown> = {};

		for (const node of nodes().slice(0, 2)) {
			const install = await call(node.url, 'POST', '/extensions/registry/install', SANDBOXED);
			const row = await hostDb()('directus_extensions')
				.where({ id: SANDBOXED.extension })
				.first('id', 'folder', 'source', 'bundle');
			const files = stored(SANDBOXED.version);
			const uninstall = await call(node.url, 'DELETE', `/extensions/registry/uninstall/${SANDBOXED.extension}`);
			const left = await hostDb()('directus_extensions').where({ id: SANDBOXED.extension }).first('id');
			seen[node.name] = {
				install: install.status,
				row,
				files,
				uninstall: uninstall.status,
				left,
				after: stored(SANDBOXED.version),
			};
		}

		expect(seen['backoffice']).toEqual(seen['directus']);
		expect(seen['directus']).toMatchObject({
			install: 204,
			row: { id: SANDBOXED.extension, folder: SANDBOXED.version, source: 'registry', bundle: null },
			uninstall: 204,
			left: undefined,
			after: [],
		});
		expect((seen['directus'] as { files: string[] }).files).toEqual(
			expect.arrayContaining(['package.json', 'dist/index.js']),
		);
	});

	it('a non-sandboxed extension under MARKETPLACE_TRUST=sandbox: 503 with the same reason, the row left', async () => {
		const seen: Record<string, unknown> = {};

		for (const node of nodes().slice(0, 2)) {
			await hostDb()('directus_extensions').where({ id: NOT_SANDBOXED.extension }).delete();
			const install = await call(node.url, 'POST', '/extensions/registry/install', NOT_SANDBOXED);
			const row = await hostDb()('directus_extensions').where({ id: NOT_SANDBOXED.extension }).first('id', 'source');
			seen[node.name] = { status: install.status, error: install.json?.errors?.[0]?.extensions, row };
		}

		expect(seen['backoffice']).toEqual(seen['directus']);
		expect(seen['directus']).toEqual({
			status: 503,
			error: { service: 'marketplace', reason: 'Could not download the extension', code: 'SERVICE_UNAVAILABLE' },
			row: { id: NOT_SANDBOXED.extension, source: 'registry' },
		});
	});
});
