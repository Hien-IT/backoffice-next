// Feature 004, US1.4, US1.5 (FR-004): the routes of feature 001 read the token like Directus (D-10 removed). Admin,
// user, wrong, wrong signature and expired tokens on /server/info, /server/health, /server/specs/oas and /metrics;
// the paths Directus answers before its authenticate step ignore even a wrong token.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signAccessToken } from '../auth/tokens.js';
import { appUrl } from '../directus-api.js';
import { assertParity, capture, parity, parityStable, type ParityRequest, type ParityResult } from '../parity.js';
import { profileUrls } from '../profiles.js';
import { attachPolicy, cleanup, createPolicy, createRoleTree, createUser, type TestUser } from './fixtures.js';

const suite = process.env['PARITY_SUITE'] ?? 'full';
const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

let admin: string;
let user: TestUser;
let role: string;

beforeAll(async () => {
	const login = await capture(appUrl('directus'), {
		method: 'POST',
		path: '/auth/login',
		body: { email: 'admin@example.com', password: 'password' },
	});

	admin = (login.json as any).data.access_token;
	role = (await createRoleTree('directus', 'parity-us1-server')).leaf;
	await attachPolicy('directus', await createPolicy('directus', 'parity-us1-server', { app: true }), { role });
	user = await createUser('directus', 'parity-us1-server', { role });
}, 60_000);

afterAll(cleanup, 60_000);

const tokens = () =>
	({
		admin: bearer(admin),
		user: bearer(user.token),
		unknown: bearer('not-a-known-static-token'),
		'wrong signature': bearer(
			signAccessToken({ id: user.id, role, app_access: true, admin_access: false }, { secret: 'not-the-secret' }),
		),
		expired: bearer(signAccessToken({ id: user.id, role, app_access: true, admin_access: false }, { expiresIn: -10 })),
	}) as Record<string, Record<string, string>>;

const STATUS: Record<string, number> = { admin: 200, user: 200, unknown: 401, 'wrong signature': 403, expired: 401 };

/** The admin health body holds timings (observedValue, normalized), so its raw length and ETag vary per call. */
function assertSame(path: string, result: ParityResult): void {
	if (path.startsWith('/server/health') && result.directus.status === 200 && (result.directus.json as any)?.checks) {
		expect(result.differences.filter((d) => !(d.kind === 'header' && d.location === 'etag'))).toEqual([]);
	} else {
		assertParity(result);
	}
}

describe.each(['/server/info', '/server/health', '/server/specs/oas'])('%s', (path) => {
	it.each(Object.keys(STATUS))('%s token', async (kind) => {
		const req: ParityRequest = { path, headers: tokens()[kind]! };
		const result = path === '/server/health' ? await parityStable(req) : await parity(req);
		assertSame(path, result);
		expect(result.directus.status).toBe(STATUS[kind]);
	});

	it('access_token query parameter of the admin', async () => {
		const result = await parity({ path: `${path}?access_token=${admin}` });
		assertSame(path, result);
		expect(result.directus.status).toBe(200);
	});
});

describe('paths answered before the authenticate step', () => {
	it.each(['/', '/robots.txt', '/server/ping'])('%s ignores a wrong token', async (path) => {
		const result = await parity({ path, headers: bearer('not-a-known-static-token') });
		assertParity(result);
		expect(result.directus.status).not.toBe(401);
	});
});

describe.runIf(suite === 'full' && profileUrls('metrics'))('/metrics (profile metrics)', () => {
	const urls = () => profileUrls('metrics')!;

	it.each(Object.keys(STATUS))('%s token, no Metrics token', async (kind) => {
		const result = await parity({ path: '/metrics', headers: tokens()[kind]! }, urls());

		// Metric values differ by nature (FR-103): compare status and headers only.
		expect(result.differences.filter((d) => d.kind !== 'body')).toEqual([]);
		expect(result.backoffice.status).toBe(result.directus.status);
		if (result.directus.status !== 200) assertParity(result);
	});
});
