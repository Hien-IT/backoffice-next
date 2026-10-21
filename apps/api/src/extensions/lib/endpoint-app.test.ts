// Spec 020 (D-139 revised 2026-10-21): routes of endpoint extensions behave as on Directus' Express 4.21.2 while the
// host app is Express 5, and a request leaving the Express 4 app is an Express 5 request again.
import express from 'express';
import express4 from 'express4';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createEndpointApp } from './endpoint-app.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({ IP_TRUST_PROXY: true, QUERYSTRING_MAX_PARSE_DEPTH: 10, QUERYSTRING_ARRAY_LIMIT: 100 })),
}));

function host() {
	const router = express4.Router();
	const scoped = express4.Router();
	router.use('/demo', scoped);

	scoped.get('/optional/:id?', (req, res) =>
		res.json({ id: (req.params as Record<string, string | undefined>)['id'] ?? null }),
	);
	scoped.get('/param/:id', (req, res) => res.json({ id: (req as any).param('id') }));
	scoped.post('/created', (_req, res) => (res as any).send(201));
	scoped.get('/query', (req, res) => {
		req.query = { replaced: 'yes' };
		res.json(req.query);
	});
	scoped.get('/info', (req, res) => res.json({ host: (req as any).host, body: req.body, nested: req.query }));
	scoped.get('/*', (req, res) => res.json({ wildcard: (req.params as unknown as string[])[0] }));

	const app = express();
	app.use(createEndpointApp(router));
	// After the Express 4 app: Express 5 again (res.send(number) is a body there, not a status).
	app.get('/after', (_req, res) => res.send(201 as any));
	return app;
}

test('Express 4 path syntax: optional parameter and unnamed wildcard', async () => {
	const app = host();

	expect((await request(app).get('/demo/optional')).body).toEqual({ id: null });
	expect((await request(app).get('/demo/optional/7')).body).toEqual({ id: '7' });
	expect((await request(app).get('/demo/a/b.css')).body).toEqual({ wildcard: 'a/b.css' });
});

test('Express 4 request and response: req.param, res.send(status), writable req.query, host, body, query parser', async () => {
	const app = host();

	expect((await request(app).get('/demo/param/5')).body).toEqual({ id: '5' });
	expect((await request(app).post('/demo/created')).status).toBe(201);
	expect((await request(app).get('/demo/query?x=1')).body).toEqual({ replaced: 'yes' });

	const info = await request(app).get('/demo/info?filter[a][b]=1').set('host', 'cms.test:8055');
	expect(info.body).toEqual({ host: 'cms.test', body: {}, nested: { filter: { a: { b: '1' } } } });
});

test('a request that leaves the Express 4 app is an Express 5 request again; unknown paths fall through', async () => {
	const app = host();

	const after = await request(app).get('/after');
	expect(after.status).toBe(200);
	expect(after.text).toBe('201');

	expect((await request(app).get('/unknown')).status).toBe(404);
});
