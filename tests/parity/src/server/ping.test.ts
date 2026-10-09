// Ported from directus/tests/blackbox/tests/db/routes/server/ping.test.ts (REST part through parity();
// the GraphQL `server_ping` part waits for feature 011, D-09.9).
import { describe, expect, it } from 'vitest';
import { assertParity, parity } from '../parity.js';

describe('/server', () => {
	describe('GET /ping', () => {
		it('pong, same status, headers and body (only D-01 differs)', async () => {
			const result = await parity({ path: '/server/ping' });
			assertParity(result);
			expect(result.backoffice.status).toBe(200);
			expect(result.backoffice.headers['content-type']).toMatch(/text\/html/);
			expect(result.backoffice.text).toBe('pong');
			expect(result.accepted.map((d) => d.id)).toEqual(['D-01']);
		});

		it.each([
			['invalid Bearer token', { authorization: 'Bearer invalid' }, '/server/ping'],
			['invalid access_token', {}, '/server/ping?access_token=invalid'],
		])('%s → still pong', async (_label, headers, path) => {
			const result = await parity({ path, headers });
			assertParity(result);
			expect(result.backoffice.text).toBe('pong');
		});

		it('access_token and Bearer together → 400 INVALID_PAYLOAD on both', async () => {
			const result = await parity({ path: '/server/ping?access_token=a', headers: { authorization: 'Bearer b' } });
			assertParity(result);
			expect(result.backoffice.status).toBe(400);
			expect((result.backoffice.json as any).errors[0].extensions.code).toBe('INVALID_PAYLOAD');
		});
	});
});
