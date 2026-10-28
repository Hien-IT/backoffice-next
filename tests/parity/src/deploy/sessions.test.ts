// Feature 019, US3 (FR-030): a login at one instance works at every instance (3 BE replicas + Directus), with no sticky
// session: tokens, refresh, session cookie, logout and the failed-login counter are shared through the DB and Redis.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest';
import { adminToken, api, directusUrl, instanceUrls, sharedEnv } from './instances.js';

const created: string[] = [];
let urls: string[];
let admin: string;

const login = (url: string, body: Record<string, unknown>) => api(url, 'POST', '/auth/login', { body });

beforeAll(async () => {
	urls = instanceUrls();
	admin = await adminToken(directusUrl);
});

afterAll(async () => {
	for (const id of created) await api(directusUrl, 'DELETE', `/users/${id}`, { token: admin });
});

async function user(): Promise<{ id: string; email: string; password: string }> {
	const email = `deploy-${randomUUID().slice(0, 8)}@example.com`;
	const password = randomUUID();
	const res = await api(directusUrl, 'POST', '/users', {
		token: admin,
		body: { email, password, role: null, status: 'active' },
	});
	expect(res.status).toBe(200);
	created.push(res.body.data.id);
	return { id: res.body.data.id, email, password };
}

describe('one login, every instance', () => {
	it('accepts the access token of one instance at all of them', async () => {
		const env = sharedEnv();
		const res = await login(urls[0]!, { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'] });
		const token = res.body.data.access_token;
		const ids = new Set<string>();
		for (const url of urls) {
			const me = await api(url, 'GET', '/users/me', { token });
			expect(me.status, url).toBe(200);
			ids.add(me.body.data.id);
			expect((await api(url, 'GET', '/users?limit=1', { token })).status, url).toBe(200);
		}
		expect(ids.size).toBe(1);
	});

	it('refreshes at another instance, and a logout at a third ends the refresh token everywhere', async () => {
		const env = sharedEnv();
		const first = await login(urls[0]!, { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'], mode: 'json' });
		const refreshed = await api(urls[1]!, 'POST', '/auth/refresh', {
			body: { refresh_token: first.body.data.refresh_token, mode: 'json' },
		});
		expect(refreshed.status).toBe(200);
		const { access_token, refresh_token } = refreshed.body.data;
		for (const url of [urls[2]!, directusUrl])
			expect((await api(url, 'GET', '/users/me', { token: access_token })).status, url).toBe(200);

		expect((await api(directusUrl, 'POST', '/auth/logout', { body: { refresh_token, mode: 'json' } })).status).toBe(
			204,
		);
		for (const url of urls) {
			const again = await api(url, 'POST', '/auth/refresh', { body: { refresh_token, mode: 'json' } });
			expect(again.status, url).toBe(401);
		}
	});

	it('shares the session cookie, and ends it everywhere on logout', async () => {
		const env = sharedEnv();
		const res = await login(urls[0]!, { email: env['ADMIN_EMAIL'], password: env['ADMIN_PASSWORD'], mode: 'session' });
		const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
		for (const url of urls) {
			const me = await api(url, 'GET', '/users/me', { headers: { cookie } });
			expect(me.status, url).toBe(200);
		}
		expect(
			(await api(urls[2]!, 'POST', '/auth/logout', { body: { mode: 'session' }, headers: { cookie } })).status,
		).toBe(204);
		for (const url of urls) {
			const me = await api(url, 'GET', '/users/me', { headers: { cookie } });
			expect(me.status, url).not.toBe(200);
		}
	});

	it('counts login attempts across instances like one Directus does (auth_login_attempts)', async () => {
		// The threshold is the project setting auth_login_attempts (directus/api/src/services/authentication.ts:137-149);
		// each login of an active user takes one point, the user is suspended on the attempt past the threshold.
		const previous = (await api(directusUrl, 'GET', '/settings?fields=auth_login_attempts', { token: admin })).body.data
			.auth_login_attempts;
		await api(directusUrl, 'PATCH', '/settings', { token: admin, body: { auth_login_attempts: 3 } });
		onTestFinished(async () => {
			await api(directusUrl, 'PATCH', '/settings', { token: admin, body: { auth_login_attempts: previous } });
		});
		const attempts = 3;
		const outcome = async (pick: (i: number) => string) => {
			const u = await user();
			for (let i = 0; i < attempts; i++) await login(pick(i), { email: u.email, password: 'wrong' });
			const last = await login(pick(attempts), { email: u.email, password: u.password });
			const row = await api(directusUrl, 'GET', `/users/${u.id}?fields=status`, { token: admin });
			return { status: last.status, code: last.body?.errors?.[0]?.extensions?.code, user: row.body.data.status };
		};

		const spread = await outcome((i) => urls[i % urls.length]!);
		const single = await outcome(() => directusUrl);
		expect(spread).toEqual(single);
		expect(spread.user).toBe('suspended');
	});
});
