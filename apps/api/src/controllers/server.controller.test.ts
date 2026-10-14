import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { ForbiddenError, InternalServerError } from '@backoffice/errors';
import { createAdmin } from '../utils/create-admin.js';
import { ServerController } from './server.controller.js';

// An empty env at import time: the services behind respond (export) read it when their module loads.
vi.mock('@backoffice/env', () => ({ useEnv: vi.fn(() => ({})) }));
// Only used as DI tokens here; the real modules load the rate limiters (and the logger) at import time.
vi.mock('../services/server.service.js', () => ({ ServerService: class {} }));
vi.mock('../services/specifications.service.js', () => ({ SpecificationService: class {} }));
vi.mock('../services/settings.service.js', () => ({ SettingsService: class {} }));
vi.mock('../utils/create-admin.js', () => ({ createAdmin: vi.fn() }));

function res() {
	const r: any = { locals: {}, headers: {} as Record<string, string> };
	r.setHeader = vi.fn((k: string, v: string) => (r.headers[k] = v));
	r.status = vi.fn(() => r);
	r.json = vi.fn();
	r.end = vi.fn();
	return r;
}

const serverService = { serverInfo: vi.fn(), health: vi.fn(), isSetupCompleted: vi.fn() };
const oas = { generate: vi.fn() };
const serverFactory = vi.fn((_options: unknown) => serverService as any);
const specificationFactory = vi.fn((_options: unknown) => ({ oas }) as any);
const settingsService = { setOwner: vi.fn() };
const settingsFactory = vi.fn((_options: unknown) => settingsService as any);
const controller = () => new ServerController(serverFactory, specificationFactory, settingsFactory);
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

// Feature 010 (spec FR-013, contracts/system-api.md §5).
const setupBody = { project_owner: 'owner@example.com', password: 'secret', first_name: 'A', last_name: 'B' };

// Feature 011 (spec FR-042, FR-043, research R12.6).
test('GET /server/specs/graphql[/:scope] → the SDL of the scope as an attachment named after the project', async () => {
	const graphql = { generate: vi.fn(async (scope: string) => `type Query { ${scope}: Int }`) };
	specificationFactory.mockReturnValueOnce({ oas, graphql } as any).mockReturnValueOnce({ oas, graphql } as any);
	serverService.serverInfo.mockResolvedValue({ project: { project_name: 'Directus' } });

	const sent = () => {
		const r = res();
		r.attachment = vi.fn();
		r.send = vi.fn();
		return r;
	};

	let r = sent();
	await controller().graphql({ ...req, path: '/server/specs/graphql', params: {} }, r);
	expect(graphql.generate).toHaveBeenCalledWith('items');
	expect(r.attachment).toHaveBeenCalledWith(expect.stringMatching(/^Directus_\d{4}-\d{2}-\d{2}\.graphql$/));
	expect(r.send).toHaveBeenCalledWith('type Query { items: Int }');

	r = sent();
	await controller().graphqlScope({ ...req, path: '/server/specs/graphql/system', params: { scope: 'system' } }, r);
	expect(graphql.generate).toHaveBeenLastCalledWith('system');
	expect(r.send).toHaveBeenCalledWith('type Query { system: Int }');
});

test('GET /server/specs/graphql/:scope: another scope → 404 with the path inside the router; introspection off → 404', async () => {
	await expect(
		controller().graphqlScope({ ...req, path: '/server/specs/graphql/x', params: { scope: 'x' } }, res()),
	).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND', extensions: { path: '/specs/graphql/x' } });

	vi.mocked(useEnv).mockReturnValue({ GRAPHQL_INTROSPECTION: false });

	await expect(
		controller().graphql({ ...req, path: '/server/specs/graphql', params: {} }, res()),
	).rejects.toMatchObject({ code: 'ROUTE_NOT_FOUND', extensions: { path: '/server/specs/graphql' } });
});

test('POST /server/setup with users already → 403, no admin created', async () => {
	serverService.isSetupCompleted.mockResolvedValue(true);

	await expect(controller().setup({ ...req, body: setupBody }, res())).rejects.toBeInstanceOf(ForbiddenError);
	expect(createAdmin).not.toHaveBeenCalled();
	expect(serverFactory).toHaveBeenCalledWith({ schema });
});

test('POST /server/setup → createAdmin with the body, setOwner not awaited, 204', async () => {
	serverService.isSetupCompleted.mockResolvedValue(false);
	let resolveOwner: () => void = () => undefined;
	settingsService.setOwner.mockReturnValue(new Promise<void>((resolve) => (resolveOwner = resolve)));
	const r = res();

	await controller().setup({ ...req, body: { ...setupBody, org_name: 'O' } }, r);

	expect(createAdmin).toHaveBeenCalledWith(schema, {
		email: 'owner@example.com',
		password: 'secret',
		first_name: 'A',
		last_name: 'B',
	});
	expect(settingsFactory).toHaveBeenCalledWith({ schema });
	expect(settingsService.setOwner).toHaveBeenCalledWith({ ...setupBody, org_name: 'O' });
	expect(r.status).toHaveBeenCalledWith(204);
	resolveOwner();
});

test('POST /server/setup: a Forbidden error inside → 204, any other error is thrown', async () => {
	serverService.isSetupCompleted.mockResolvedValue(false);
	vi.mocked(createAdmin).mockRejectedValueOnce(new ForbiddenError());
	const r = res();
	await controller().setup({ ...req, body: setupBody }, r);
	expect(r.status).toHaveBeenCalledWith(204);

	vi.mocked(createAdmin).mockRejectedValueOnce(new InternalServerError());
	await expect(controller().setup({ ...req, body: setupBody }, res())).rejects.toBeInstanceOf(InternalServerError);
});
