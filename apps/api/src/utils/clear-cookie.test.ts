import express from 'express';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { clearCookie } from './clear-cookie.js';

function setCookie(options?: express.CookieOptions): Promise<string> {
	const app = express();
	app.get('/', (_req, res) => clearCookie(res, 'directus_refresh_token', options).end());
	return request(app)
		.get('/')
		.then((res) => (res.headers['set-cookie'] as unknown as string[])[0]!);
}

describe('clearCookie', () => {
	test('expires the cookie at the epoch when no options are given', async () => {
		expect(await setCookie()).toBe('directus_refresh_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
	});

	test('keeps Max-Age and a future Expires from the options, like Express 4.21.2', async () => {
		const header = await setCookie({ httpOnly: true, maxAge: 604800000, sameSite: 'lax' });
		expect(header).toMatch(/^directus_refresh_token=; Max-Age=604800; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax$/);

		const expires = Date.parse(header.match(/Expires=([^;]+)/)![1]!);
		expect(expires).toBeGreaterThan(Date.now() + 604000000);
	});
});
