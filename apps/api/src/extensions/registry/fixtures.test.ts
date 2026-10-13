// Feature 010 (T049, research R12): the fixtures of the fake registry of the parity environment parse with the
// ported response schemas, so the fake registry and the client cannot drift apart.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { RegistryAccountResponse } from './modules/account/schemas/registry-account-response.js';
import { RegistryDescribeResponse } from './modules/describe/schemas/registry-describe-response.js';
import { RegistryListResponse } from './modules/list/schemas/registry-list-response.js';

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
