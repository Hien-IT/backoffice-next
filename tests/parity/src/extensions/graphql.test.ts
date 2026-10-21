// Spec 020 US5 (FR-036, T025): the extensions query of /graphql/system, with and without the name field, and
// update_extensions_item, at both apps (the mutation as a scenario that restores the row).
import { afterAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { adminToken } from '../directus-api.js';
import { gql, sameGql } from '../graphql/helpers.js';
import { extRows } from './helpers.js';

afterAll(async () => {
	await closeHostDb();
});

describe('extensions', () => {
	it('with and without name, as admin and public', async () => {
		const token = await adminToken('directus');

		await sameGql('system', '{ extensions { bundle name schema { type local } meta { enabled } } }', { token });
		await sameGql('system', '{ extensions { bundle schema { type } meta { enabled } } }', { token });
		await sameGql('system', '{ extensions { bundle } }');
	});
});

describe('update_extensions_item', () => {
	it('disable then enable at each app: the same data and rows', async () => {
		const row = (await extRows()).find((r) => r.folder === 'parity-display-badge' && r.bundle === null)!;
		const doc = (enabled: boolean) =>
			`mutation { update_extensions_item(id: "${row.id}", data: { meta: { enabled: ${enabled} } }) { bundle name meta { enabled } } }`;

		const out: Record<string, unknown[]> = {};

		for (const app of ['directus', 'backoffice'] as const) {
			const token = await adminToken(app);
			out[app] = [];

			for (const enabled of [false, true]) {
				const result = await gql(app, 'system', doc(enabled), { token });
				const stored = (await extRows()).find((r) => r.id === row.id)!.enabled;
				out[app]!.push({ status: result.status, json: result.json, stored });
			}
		}

		expect(out['backoffice']).toEqual(out['directus']);
		expect(out['directus']![0]).toMatchObject({ stored: false });
	});
});
