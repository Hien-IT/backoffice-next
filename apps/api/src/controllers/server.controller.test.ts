import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { ServerController } from './server.controller.js';

vi.mock('@backoffice/env');
// Only used as DI tokens here; the real modules load the rate limiters (and the logger) at import time.
vi.mock('../services/server.service.js', () => ({ ServerService: class {} }));
vi.mock('../services/specifications.service.js', () => ({ SpecificationService: class {} }));

function res() {
	const r: any = { locals: {}, headers: {} as Record<string, string> };
	r.setHeader = vi.fn((k: string, v: string) => (r.headers[k] = v));
	r.status = vi.fn(() => r);
	r.json = vi.fn();
	r.end = vi.fn();
	return r;
}

const serverService = { serverInfo: vi.fn(), health: vi.fn() };
const oas = { generate: vi.fn() };
const serverFactory = vi.fn((_options: unknown) => serverService as any);
const specificationFactory = vi.fn((_options: unknown) => ({ oas }) as any);
const controller = () => new ServerController(serverFactory, specificationFactory);
const schema = { collections: {}, relations: [] };
const req = {
	method: 'GET',
	originalUrl: '/server/info',
	accountability: { role: null },
	headers: { host: 'h' },
	path: '/server/specs/oas',
	schema,
	sanitizedQuery: {},
} as any;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useEnv).mockReturnValue({});
});

test('GET /server/info → {data}, no-cache', async () => {
	serverService.serverInfo.mockResolvedValue({ project: {} });
	const r = res();
	await controller().info(req, r);
	expect(r.json).toHaveBeenCalledWith({ data: { project: {} } });
	expect(r.headers).toEqual({ 'Cache-Control': 'no-cache', Vary: 'Origin, Cache-Control' });
	// FR-023: the schema of the request (schema middleware), not a fresh one
	expect(serverFactory).toHaveBeenCalledWith({ accountability: req.accountability, schema });
});

test('GET /server/health → application/health+json; 503 on error', async () => {
	serverService.health.mockResolvedValue({ status: 'ok' });
	let r = res();
	await controller().health(req, r);
	expect(r.headers['Content-Type']).toBe('application/health+json');
	expect(r.status).not.toHaveBeenCalled();
	// Never stored in the response cache (spec FR-014), as directus/api/src/controllers/server.ts.
	expect(r.locals.cache).toBe(false);

	serverService.health.mockResolvedValue({ status: 'error' });
	r = res();
	await controller().health(req, r);
	expect(r.status).toHaveBeenCalledWith(503);
	expect(r.json).toHaveBeenCalledWith({ status: 'error' });
});

test('GET /server/specs/oas → generated spec with the Host header; 404 when OPENAPI_ENABLED=false', async () => {
	oas.generate.mockResolvedValue({ openapi: '3.0.1' });
	const r = res();
	await controller().oas(req, r);
	expect(oas.generate).toHaveBeenCalledWith('h');
	expect(specificationFactory).toHaveBeenCalledWith({ accountability: req.accountability, schema });
	expect(r.json).toHaveBeenCalledWith({ openapi: '3.0.1' });

	vi.mocked(useEnv).mockReturnValue({ OPENAPI_ENABLED: false });
	await expect(controller().oas(req, res())).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
});
