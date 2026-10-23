import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';

vi.mock('@backoffice/env');

beforeEach(() => {
	vi.resetModules();
});

// cors.ts reads the env once, when the module loads (like DR).
test('no middleware when CORS is disabled', async () => {
	vi.mocked(useEnv).mockReturnValue({ CORS_ENABLED: false });
	const { default: cors } = await import('./cors.js');
	expect(typeof cors).toBe('function');
	const next = vi.fn();
	cors({} as any, {} as any, next);
	expect(next).toHaveBeenCalledOnce();
});

test('cors() configured from CORS_* when enabled', async () => {
	vi.mocked(useEnv).mockReturnValue({
		CORS_ENABLED: true,
		CORS_ORIGIN: true,
		CORS_METHODS: 'GET,POST',
		CORS_ALLOWED_HEADERS: 'Content-Type',
		CORS_EXPOSED_HEADERS: 'Content-Range',
		CORS_CREDENTIALS: true,
		CORS_MAX_AGE: 18000,
	});

	const { default: cors } = await import('./cors.js');
	const headers: Record<string, string> = {};
	const res = {
		setHeader: (k: string, v: string) => (headers[k.toLowerCase()] = v),
		getHeader: () => undefined,
		end: vi.fn(),
		statusCode: 200,
	};
	const req = { method: 'OPTIONS', headers: { origin: 'https://a.test', 'access-control-request-method': 'GET' } };

	cors(req as any, res as any, vi.fn());

	expect(headers).toMatchObject({
		'access-control-allow-origin': 'https://a.test',
		'access-control-allow-methods': 'GET,POST',
		'access-control-allow-headers': 'Content-Type',
		'access-control-expose-headers': 'Content-Range',
		'access-control-allow-credentials': 'true',
		'access-control-max-age': '18000',
	});
});
