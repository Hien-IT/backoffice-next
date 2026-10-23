// Spec 020 (D-139 revised 2026-10-21): routes of endpoint extensions behave as on DR' Express 4.21.2 while the
// host app is Express 5, and a request leaving the Express 4 app is an Express 5 request again.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import express4 from 'express4';
import request from 'supertest';
import { expect, test, vi } from 'vitest';
import { createEndpointApp } from './endpoint-app.js';

vi.mock('@backoffice/env', () => ({
	useEnv: vi.fn(() => ({ IP_TRUST_PROXY: true, QUERYSTRING_MAX_PARSE_DEPTH: 10, QUERYSTRING_ARRAY_LIMIT: 100 })),
}));

const files = mkdtempSync(join(tmpdir(), 'endpoint-app-'));
writeFileSync(join(files, 'hello.txt'), 'hello world');

function host() {
	const router = express4.Router();
	const scoped = express4.Router();
	router.use('/demo', scoped);

	// Static files and sendFile, as extensions like directus-extension-dirserve serve them.
	scoped.use('/static', express4.static(files));
	scoped.get('/file', (_req, res) => res.sendFile(join(files, 'hello.txt')));
	// What the Express 5 middlewares set before (accountability, locals) and the trust proxy setting.
	scoped.get('/state', (req, res) =>
		res.json({ accountability: (req as any).accountability, locals: res.locals['seen'], ip: req.ip }),
	);
	scoped.get('/throw', () => {
		throw new Error('boom');
	});
	scoped.get('/later', async (_req, res) => {
		await new Promise((resolve) => setTimeout(resolve, 10));
		(res as any).send(202);
	});

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
	app.use((req, res, next) => {
		(req as any).accountability = { user: 'u1', admin: false };
		res.locals['seen'] = 'express5';
		next();
	});
	app.use(createEndpointApp(router));
	// After the Express 4 app: Express 5 again (res.send(number) is a body there, not a status).
	app.get('/after', (_req, res) => res.send(201 as any));
	// The error handler of the host gets the Express 5 request back (no req.param).
	app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) =>
		res.status(500).json({ message: error.message, express4: typeof (req as any).param === 'function' }),
	);
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

test('static files and sendFile: body, type, HEAD, range, conditional request', async () => {
	const app = host();

	const file = await request(app).get('/demo/static/hello.txt');
	expect(file.status).toBe(200);
	expect(file.text).toBe('hello world');
	expect(file.headers['content-type']).toBe('text/plain; charset=UTF-8');

	expect((await request(app).head('/demo/static/hello.txt')).headers['content-length']).toBe('11');

	const range = await request(app).get('/demo/static/hello.txt').set('range', 'bytes=0-4');
	expect(range.status).toBe(206);
	expect(range.text).toBe('hello');

	const fresh = await request(app).get('/demo/file').set('if-none-match', file.headers['etag']!);
	expect(fresh.status).toBe(304);
	expect((await request(app).get('/demo/file')).text).toBe('hello world');
});

test('the Express 4 handler sees what Express 5 set; a thrown error reaches the Express 5 error handler', async () => {
	const app = host();

	const state = await request(app).get('/demo/state').set('x-forwarded-for', '203.0.113.9');
	expect(state.body).toEqual({ accountability: { user: 'u1', admin: false }, locals: 'express5', ip: '203.0.113.9' });

	const thrown = await request(app).get('/demo/throw');
	expect(thrown.status).toBe(500);
	expect(thrown.body).toEqual({ message: 'boom', express4: false });

	// A handler that answers after an await still has the Express 4 response (send(status)).
	expect((await request(app).get('/demo/later')).status).toBe(202);
});
