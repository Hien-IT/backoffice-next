import { useEnv } from '@backoffice/env';
import { beforeEach, expect, test, vi } from 'vitest';
import { registerWebSocketBridge } from './app.js';
import { registerWebSocketEvents } from './websocket/controllers/hooks.js';

// The logger reads the env when its module loads.
vi.mock('@backoffice/env', async (original) => ({ ...(await original<object>()), useEnv: vi.fn(() => ({})) }));
vi.mock('./websocket/controllers/hooks.js');

beforeEach(() => vi.clearAllMocks());

// Directus' server.ts:104 creates the REST and GraphQL WebSocket controllers only with WEBSOCKETS_ENABLED, each when
// its own flag is on (websocket/controllers/index.ts), and each registers the bus bridge.
test.each([
	[{ WEBSOCKETS_ENABLED: true, WEBSOCKETS_REST_ENABLED: true, WEBSOCKETS_GRAPHQL_ENABLED: false }, true],
	[{ WEBSOCKETS_ENABLED: 'true', WEBSOCKETS_REST_ENABLED: false, WEBSOCKETS_GRAPHQL_ENABLED: 'true' }, true],
	[{ WEBSOCKETS_ENABLED: false, WEBSOCKETS_REST_ENABLED: true, WEBSOCKETS_GRAPHQL_ENABLED: true }, false],
	[{ WEBSOCKETS_ENABLED: true, WEBSOCKETS_REST_ENABLED: false, WEBSOCKETS_GRAPHQL_ENABLED: false }, false],
])('%o → bridge registered: %s', (env, registered) => {
	vi.mocked(useEnv).mockReturnValue(env);
	registerWebSocketBridge();
	expect(vi.mocked(registerWebSocketEvents).mock.calls.length).toBe(registered ? 1 : 0);
});
