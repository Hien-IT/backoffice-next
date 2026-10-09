import { useEnv } from '@backoffice/env';
import { ForbiddenError, RouteNotFoundError } from '@backoffice/errors';
import { beforeEach, expect, test, vi } from 'vitest';
import { MetricsController } from './metrics.controller.js';

vi.mock('@backoffice/env');
vi.mock('../metrics/metrics.service.js', () => ({ MetricsService: class {} }));

function res() {
	const r: any = { headers: {} as Record<string, string> };
	r.set = vi.fn((k: string, v: string) => (r.headers[k] = v));
	r.setHeader = vi.fn((k: string, v: string) => (r.headers[k] = v));
	r.send = vi.fn();
	return r;
}

const metrics = { readAll: vi.fn(async () => '# HELP directus_db_pg_connection_errors\n') };
const controller = () => new MetricsController(metrics as any);
const req = (authorization?: string, accountability: any = { role: null }) =>
	({ path: '/metrics', headers: authorization ? { authorization } : {}, accountability }) as any;

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: true, METRICS_TOKENS: ['abc', 123] });
});

test.each(['Metrics abc', 'metrics abc', 'METRICS 123'])(
	'%s → text/plain, no-cache, Vary, prom-client body',
	async (auth) => {
		const r = res();
		await controller().read(req(auth), r);
		expect(r.headers).toEqual({
			'Content-Type': 'text/plain',
			'Cache-Control': 'no-cache',
			Vary: 'Origin, Cache-Control',
		});
		expect(r.send).toHaveBeenCalledWith('# HELP directus_db_pg_connection_errors\n');
	},
);

test.each([undefined, 'Metrics wrong', 'Bearer abc', 'Metrics', 'Metrics abc extra', 'abc'])(
	'Authorization %s → 403 FORBIDDEN (D-10 for Bearer)',
	async (auth) => {
		await expect(controller().read(req(auth), res())).rejects.toBeInstanceOf(ForbiddenError);
		expect(metrics.readAll).not.toHaveBeenCalled();
	},
);

test('no METRICS_TOKENS → 403 even with a Metrics header', async () => {
	vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: true });
	await expect(controller().read(req('Metrics abc'), res())).rejects.toBeInstanceOf(ForbiddenError);
});

test('admin accountability passes without a token (feature 003 sets it)', async () => {
	const r = res();
	await controller().read(req(undefined, { admin: true }), r);
	expect(r.send).toHaveBeenCalled();
});

test('METRICS_ENABLED=false → 404 ROUTE_NOT_FOUND for the path', async () => {
	vi.mocked(useEnv).mockReturnValue({ METRICS_ENABLED: false, METRICS_TOKENS: ['abc'] });
	const error = await controller()
		.read(req('Metrics abc'), res())
		.catch((e) => e);
	expect(error).toBeInstanceOf(RouteNotFoundError);
	expect(error.extensions).toEqual({ path: '/metrics' });
});
