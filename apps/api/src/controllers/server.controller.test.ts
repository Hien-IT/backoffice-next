import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { getSchema } from '../schema/get-database-schema.js';
import { ServerController } from './server.controller.js';

vi.mock('@backoffice/env');
vi.mock('../schema/get-database-schema.js');
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
const controller = () =>
	new ServerController(
		() => serverService as any,
		() => ({ oas }) as any,
	);
const req = { accountability: { role: null }, headers: { host: 'h' }, path: '/server/specs/oas' } as any;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useEnv).mockReturnValue({});
	vi.mocked(getSchema).mockResolvedValue({ collections: {}, relations: [] });
});

test('GET /server/info → {data}, no-cache', async () => {
	serverService.serverInfo.mockResolvedValue({ project: {} });
	const r = res();
	await controller().info(req, r);
	expect(r.json).toHaveBeenCalledWith({ data: { project: {} } });
	expect(r.headers).toEqual({ 'Cache-Control': 'no-cache', Vary: 'Origin, Cache-Control' });
});

test('GET /server/health → application/health+json; 503 on error', async () => {
	serverService.health.mockResolvedValue({ status: 'ok' });
	let r = res();
	await controller().health(req, r);
	expect(r.headers['Content-Type']).toBe('application/health+json');
	expect(r.status).not.toHaveBeenCalled();

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
	expect(r.json).toHaveBeenCalledWith({ openapi: '3.0.1' });

	vi.mocked(useEnv).mockReturnValue({ OPENAPI_ENABLED: false });
	await expect(controller().oas(req, res())).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND' });
});
