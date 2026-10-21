// Feature 010 (T049, research R12): the fixtures of the fake registry of the parity environment parse with the
// ported response schemas, so the fake registry and the client cannot drift apart.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { RegistryAccountResponse } from './modules/account/schemas/registry-account-response.js';
import { RegistryDescribeResponse } from './modules/describe/schemas/registry-describe-response.js';
import { RegistryListResponse } from './modules/list/schemas/registry-list-response.js';

// Read by server.mjs when it loads: the packed fixture extensions of the repository (the container mounts them at /fixtures).
process.env['FIXTURES_DIR'] = new URL('../../../../../tests/fixtures/extensions', import.meta.url).pathname;

const fixture = (name: string) =>
	JSON.parse(
		readFileSync(new URL(`../../../../../tests/parity/registry/fixtures/${name}.json`, import.meta.url), 'utf8'),
	);

test('list.json through the GET /extensions of the fake registry: a RegistryListResponse', async () => {
	// @ts-expect-error plain ESM script without types
	const { listExtensions } = await import('../../../../../tests/parity/registry/server.mjs');
	const rows = fixture('list');
	const list = RegistryListResponse.parse(listExtensions(rows, new URLSearchParams({ limit: '100' })));
	expect(list.data.length).toBe(rows.length);
	expect(list.meta.filter_count).toBe(rows.length);
});

test('describe.json: every entry is a RegistryDescribeResponse', () => {
	const describe = fixture('describe');
	const entries = Array.isArray(describe) ? describe : Object.values(describe);
	expect(entries.length).toBeGreaterThan(0);
	for (const entry of entries) RegistryDescribeResponse.parse(entry);
});

test('accounts.json: every entry is a RegistryAccountResponse', () => {
	const accounts = fixture('accounts');
	const entries = Array.isArray(accounts) ? accounts : Object.values(accounts);
	expect(entries.length).toBeGreaterThan(0);
	for (const entry of entries) RegistryAccountResponse.parse(entry);
});

test('GET /download/:versionId: the .tgz of every version; 404 for sandbox=true on a non-sandboxed extension (T171)', async () => {
	// @ts-expect-error plain ESM script without types
	const { createRegistryServer } = await import('../../../../../tests/parity/registry/server.mjs');
	const server = createRegistryServer();
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

	try {
		const rows = fixture('list') as { id: string; sandbox: boolean }[];
		const describe = fixture('describe') as Record<string, { data: { versions: { id: string }[] } }>;

		for (const row of rows) {
			const versionId = describe[row.id]!.data.versions[0]!.id;
			const res = await fetch(`${base}/download/${versionId}`);
			expect(res.status, row.id).toBe(200);
			// gzip magic number of the packed tarball
			expect([...new Uint8Array(await res.arrayBuffer()).slice(0, 2)]).toEqual([0x1f, 0x8b]);
			expect((await fetch(`${base}/download/${versionId}?sandbox=true`)).status).toBe(row.sandbox ? 200 : 404);
		}

		expect((await fetch(`${base}/download/f0000000-0000-4000-8000-0000000000ff`)).status).toBe(404);
	} finally {
		server.close();
	}
});

