// Spec 029 (US4 scenario 4, SC-005, Principle VII): passkey challenges live in the shared Redis, so a challenge one BE
// replica issued is verified by another, and the session it creates works through the lb and at Directus.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFakeAuthenticator } from '../auth/webauthn-fake.js';
import { adminToken, api, BO_PUBLIC_URL, boLbUrl, directusUrl, replicaUrl, STANDALONE } from './instances.js';

const EMAIL = 'bo-deploy-passkey@example.com';
const PASSWORD = 'bo-deploy-Password1';
const TOKEN = 'bo-deploy-passkey-static-token';

let admin: string;
let user: string;

beforeAll(async () => {
	admin = await adminToken(replicaUrl(1));
	const res = await api(replicaUrl(1), 'POST', '/users', {
		token: admin,
		body: { email: EMAIL, password: PASSWORD, status: 'active', token: TOKEN },
	});
	expect(res.status).toBe(200);
	user = res.body.data.id;
}, 120_000);

afterAll(async () => {
	await api(replicaUrl(1), 'DELETE', `/users/${user}`, { token: admin });
});

describe('passkeys on several replicas (spec 029)', () => {
	it('register across replicas, log in across replicas, use the session through the lb and at Directus', async () => {
		const fake = createFakeAuthenticator({ origin: BO_PUBLIC_URL });

		const options = await api(replicaUrl(1), 'POST', '/backoffice/users/me/passkeys/options', {
			token: TOKEN,
			body: { password: PASSWORD },
		});
		expect(options.status).toBe(200);

		const registered = await api(replicaUrl(2), 'POST', '/backoffice/users/me/passkeys', {
			token: TOKEN,
			body: { name: 'Deploy', response: fake.register(options.body.data) },
		});
		expect(registered.status).toBe(200);

		const loginOptions = await api(replicaUrl(2), 'POST', '/backoffice/auth/passkey/login/options');
		expect(loginOptions.status).toBe(200);

		const login = await api(replicaUrl(3), 'POST', '/backoffice/auth/passkey/login', {
			body: { mode: 'json', response: fake.authenticate(loginOptions.body.data) },
		});
		expect(login.status).toBe(200);
		const token = login.body.data.access_token as string;

		expect((await api(boLbUrl, 'GET', '/users/me?fields=id', { token })).body.data).toEqual({ id: user });

		if (!STANDALONE) {
			expect((await api(directusUrl, 'GET', '/users/me?fields=id', { token })).body.data).toEqual({ id: user });
		}
	});
});
