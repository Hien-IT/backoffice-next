// Spec 020 US1 (FR-016, FR-019, T034): the endpoint fixtures at both apps. parity-endpoint-demo answers the same; the
// Express 4 idioms of parity-endpoint-express4(-path) give the results D-139 expects on Express 5 (T042 records them).
import { beforeAll, describe, expect, it } from 'vitest';
import { appUrl } from '../directus-api.js';
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
});

/** Both answers of one request; Directus may hang (D-139 item 5), so each side has its own timeout. */
async function both(req: ParityRequest): Promise<{ directus: Captured | 'timeout'; backoffice: Captured | 'timeout' }> {
	const one = (url: string) =>
		Promise.race([capture(url, req), new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 5000))]);

	const [directus, backoffice] = await Promise.all([one(appUrl('directus')), one(appUrl('backoffice'))]);
	return { directus, backoffice };
}

const status = (c: Captured | 'timeout') => (c === 'timeout' ? 'timeout' : c.status);

describe('D-139: Express 4 idioms', () => {
	it('(1) path syntax: the extension registers at Directus, not on Express 5 (404)', async () => {
		const optional = await both({ path: '/parity-endpoint-express4-path/optional' });
		expect(status(optional.directus)).toBe(200);
		expect(status(optional.backoffice)).toBe(404);

		const wild = await both({ path: '/parity-endpoint-express4-path/wild/a/b' });
		expect(status(wild.directus)).toBe(200);
		expect(status(wild.backoffice)).toBe(404);
	});

	it('(2) removed APIs and (3) req.query assignment: 500 on Express 5; res.send(status) sends the number', async () => {
		for (const path of ['/param?id=1', '/query-assign']) {
			const result = await both({ path: `/parity-endpoint-express4${path}` });
			expect(status(result.directus), path).not.toBe(500);
			expect(status(result.backoffice), path).toBe(500);
		}

		// Express 4 sends status 201; Express 5 dropped res.send(status) and sends 201 as the body (measured 2026-10-21).
		const sendStatus = await both({ path: '/parity-endpoint-express4/send-status' });
		expect(status(sendStatus.directus)).toBe(201);
		expect(status(sendStatus.backoffice)).toBe(200);
		expect((sendStatus.backoffice as Captured).text).toBe('201');
	});

	it('(4) req.host keeps the port; (6) urlencoded bodies are parsed flat', async () => {
		const host = await both({ path: '/parity-endpoint-express4/host', headers: { host: 'cms.test:8055' } });
		expect((host.directus as Captured).json).toEqual({ host: 'cms.test' });
		expect((host.backoffice as Captured).json).toEqual({ host: 'cms.test:8055' });

		const form = await both({
			method: 'POST',
			path: '/parity-endpoint-express4/form',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: 'a[b]=1',
		});

		expect(status(form.directus)).toBe(200);
		expect(status(form.backoffice)).toBe(200);
	});

	it('(5) a rejected async handler: 500 on Express 5, Directus does not answer', async () => {
		const result = await both({ path: '/parity-endpoint-express4/async-reject' });
		expect(status(result.backoffice)).toBe(500);
		expect(status(result.directus)).toBe('timeout');
	}, 15_000);
});
