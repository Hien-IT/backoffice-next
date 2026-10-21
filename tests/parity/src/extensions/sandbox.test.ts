// Spec 020 US7 (FR-020 to FR-026, T081): the sandboxed fixtures at both apps. The endpoint uses the log, sleep and
// request scopes (a URL in scope, one outside, a method outside); the hook filters an item in the isolate; the
// operation runs in a flow. The /slow and /memory routes are not called here: a handler past
// EXTENSIONS_SANDBOX_TIMEOUT makes isolated-vm 5.0.3 report "Script failed to terminate" on Node 22 and the process
// aborts (tasks.md, notes of wave 1); the load case of SC-004 waits for that answer.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeHostDb, hostDb } from '../auth/db-effects.js';
import { type AppName, appUrl } from '../directus-api.js';
import { cleanupFlows, seedFlow } from '../flows/helpers.js';
import { capture } from '../parity.js';
import { admin, ensureExtensionCollections, same } from './helpers.js';

beforeAll(async () => {
	await ensureExtensionCollections();
});

afterAll(async () => {
	await hostDb()('bo_ext_items').where({ title: 'sandbox-filtered' }).delete();
	await closeHostDb();
});

describe('sandboxed endpoint', () => {
	it('log and sleep, request in scope, outside the URL scope, outside the method scope', async () => {
		const ok = await same({ path: '/parity-endpoint-sandbox' });
		expect(ok.backoffice.json).toEqual({ ok: true });

		const fetched = await same({ path: '/parity-endpoint-sandbox/fetch' });
		expect(fetched.backoffice.json).toEqual({ status: 200, data: 'hello from files-fixtures' });

		const outside = await same({ path: '/parity-endpoint-sandbox/outside' });
		expect(outside.backoffice.json).toEqual({ error: 'No permission to request "http://example.invalid/"' });

		const post = await same({ path: '/parity-endpoint-sandbox/post' });
		expect(post.backoffice.json).toEqual({ error: 'No permission to use request method "POST"' });
	});
});

describe('sandboxed hook', () => {
	it('the filter runs in the isolate at both apps', async () => {
		const out: Record<AppName, unknown> = { directus: null, backoffice: null };

		for (const app of ['directus', 'backoffice'] as const) {
			const res = await capture(appUrl(app), {
				method: 'POST',
				path: '/items/bo_ext_items',
				headers: { ...(await admin()), 'content-type': 'application/json' },
				body: { title: 'sandbox' },
			});

			out[app] = { status: res.status, title: (res.json as { data: { title: string } }).data.title };
		}

		expect(out.backoffice).toEqual(out.directus);
		expect(out.directus).toEqual({ status: 200, title: 'sandbox-filtered' });
	});
});

describe('sandboxed operation', () => {
	it('a webhook flow answers the result of the isolate at both apps', async () => {
		const flow = await seedFlow({
			trigger: 'webhook',
			options: { method: 'POST' },
			operations: [{ key: 'box', type: 'parity-operation-sandbox', options: { text: 'boxed' } }],
		});

		try {
			const result = await same({
				method: 'POST',
				path: `/flows/trigger/${flow.id}`,
				headers: { 'content-type': 'application/json' },
				body: {},
			});

			expect(result.backoffice.json).toEqual({ echoed: 'boxed' });
		} finally {
			await cleanupFlows([flow.id]);
		}
	});
});
