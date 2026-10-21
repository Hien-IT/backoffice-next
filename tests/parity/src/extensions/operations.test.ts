// Spec 020 US1 (FR-017, FR-018, T035): a webhook flow with the parity-operation-slack operation answers the same $last at
// both apps; disabled, the operation is gone at both and the flow fails the same way.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb } from '../auth/db-effects.js';
import { appRequest } from '../directus-api.js';
import { cleanupFlows, seedFlow, type SeededFlow, until } from '../flows/helpers.js';
import { capture } from '../parity.js';
import { appUrl } from '../directus-api.js';
import { extRows, same, waitAll } from './helpers.js';

let flow: SeededFlow;

beforeAll(async () => {
	flow = await seedFlow({
		trigger: 'webhook',
		options: { method: 'POST' },
		operations: [{ key: 'slack', type: 'parity-operation-slack', options: { text: 'hi {{ $trigger.body.a }}' } }],
	});
});

afterAll(async () => {
	await cleanupFlows([flow.id]);
	await closeHostDb();
});

const trigger = () => ({
	method: 'POST',
	path: `/flows/trigger/${flow.id}`,
	headers: { 'content-type': 'application/json' },
	body: { a: 1 },
});

describe('custom operation', () => {
	it('the flow answers $last of the operation at both apps', async () => {
		const result = await same(trigger());
		expect(result.backoffice.json).toEqual({ sent: 'hi 1', trigger: { a: 1 } });
	});

	it('disabled: both apps fail the flow the same way; enabled again: it runs', async () => {
		const row = (await extRows()).find((r) => r.folder === 'parity-operation-slack' && r.bundle === null)!;

		await appRequest('directus', 'PATCH', `/extensions/${row.id}`, { meta: { enabled: false } });

		try {
			await waitAll(async () => {
				for (const app of ['directus', 'backoffice'] as const) {
					const res = await capture(appUrl(app), trigger());
					if (res.status === 200 && res.text.includes('"sent"')) throw new Error(`${app} still runs it`);
				}
			});

			await same(trigger());
		} finally {
			await appRequest('directus', 'PATCH', `/extensions/${row.id}`, { meta: { enabled: true } });
		}

		expect(
			await until(async () => {
				const res = await capture(appUrl('backoffice'), trigger());
				return res.text.includes('"sent"');
			}, 10_000),
		).toBe(true);
	});
});
