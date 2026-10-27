// Spec 020 US1 (FR-016, FR-019, T034): the endpoint fixtures at both apps. parity-endpoint-demo answers the same; the
// Express 4 idioms of parity-endpoint-express4(-path) answer the same too since endpoints run on Express 4 like
// Directus (D-139 revised 2026-10-21, apps/api/src/extensions/lib/endpoint-app.ts).
import { beforeAll, describe, expect, it } from 'vitest';
import { appRequest, appUrl } from '../directus-api.js';
import { multipart } from '../files/helpers.js';
import { capture, type Captured, type ParityRequest } from '../parity.js';
import { admin, ensureExtensionCollections, same } from './helpers.js';

beforeAll(async () => {
	await ensureExtensionCollections();
});

describe('parity-endpoint-demo', () => {
	it('GET with and without a token, POST echo with a nested query, the services context', async () => {
		const headers = await admin();

		await same({ path: '/parity-endpoint-demo' });
		await same({ path: '/parity-endpoint-demo', headers });
		await same({
			method: 'POST',
			path: '/parity-endpoint-demo/echo?filter[a][_eq]=1&list[]=x',
			headers: { ...headers, 'content-type': 'application/json' },
			body: { a: [1, 2] },
		});
		await same({ path: '/parity-endpoint-demo/items', headers });
		await same({ path: '/parity-endpoint-demo/items' });
		await same({ path: '/parity-endpoint-demo/nope', headers });
	});

	// Spec 024 (FR-009, SC-004): the toggles block /items, not the route of an endpoint extension, which reads
	// bo_ext_items through ItemsService the same at both apps.
	it('the services context with every toggle of bo_ext_items off (spec 024)', async () => {
		const headers = await admin();
		const meta = (value: boolean) => ({ bo_show_search: value, bo_show_import: value, bo_show_export: value });

		await appRequest('directus', 'PATCH', '/collections/bo_ext_items', { meta: meta(false) });
		await appRequest('backoffice', 'POST', '/utils/cache/clear');

		try {
			await same({ path: '/parity-endpoint-demo/items?search=x&export=csv', headers });
		} finally {
			await appRequest('directus', 'PATCH', '/collections/bo_ext_items', { meta: meta(true) });
		}
	});
});

/** Both answers of one request; Directus may hang (D-139 item 5), so each side has its own timeout. */
async function both(req: ParityRequest): Promise<{ directus: Captured | 'timeout'; backoffice: Captured | 'timeout' }> {
	const one = (url: string) =>
		Promise.race([capture(url, req), new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5000))]);

	const [directus, backoffice] = await Promise.all([one(appUrl('directus')), one(appUrl('backoffice'))]);
	return { directus, backoffice };
}

const status = (c: Captured | 'timeout') => (c === 'timeout' ? 'timeout' : c.status);

describe('D-139 revised: Express 4 idioms answer as in Directus', () => {
	it('(1) path syntax: optional parameter and unnamed wildcard', async () => {
		await same({ path: '/parity-endpoint-express4-path/optional' });
		await same({ path: '/parity-endpoint-express4-path/optional/9' });
		await same({ path: '/parity-endpoint-express4-path/wild/a/b' });
	});

	it('(2) req.param() and res.send(status); (3) req.query assignment', async () => {
		await same({ path: '/parity-endpoint-express4/param?id=1' });
		await same({ path: '/parity-endpoint-express4/send-status' });
		await same({ path: '/parity-endpoint-express4/query-assign' });
	});

	it('(4) req.host without the port; (6) an urlencoded body', async () => {
		await same({ path: '/parity-endpoint-express4/host', headers: { host: 'cms.test:8055' } });
		await same({
			method: 'POST',
			path: '/parity-endpoint-express4/form',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: 'a[b]=1',
		});
	});

	it('(5) a rejected async handler: neither app answers', async () => {
		const result = await both({ path: '/parity-endpoint-express4/async-reject' });
		expect(status(result.directus)).toBe('timeout');
		expect(status(result.backoffice)).toBe('timeout');
	}, 15_000);

	it('(7) res.redirect(url, status); (8) a multipart body; (9) a Directus error thrown synchronously', async () => {
		await same({ path: '/parity-endpoint-express4/redirect' });

		const upload = multipart([
			{ name: 'title', value: 'a' },
			{ name: 'file', data: Buffer.alloc(4096, 1), filename: 'a.bin' },
		]);
		await same({ method: 'POST', path: '/parity-endpoint-express4/upload', ...upload });

		await same({ path: '/parity-endpoint-express4/throw-sync' });
	});
});
