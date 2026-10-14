import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { requestQueue } from '../api/sdk.ts';
import { calls, json, mockApi } from '../test-utils/fetch.ts';
import { useServerStore } from './server.ts';

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.unstubAllGlobals());

const project = { project_name: 'Acme', default_language: 'vi-VN' };

describe('hydrate', () => {
	test('reads /server/info and /auth?sessionOnly together', async () => {
		const fetch = mockApi({
			'GET /server/info': { project, setupCompleted: true, queryLimit: { default: 100, max: -1 }, version: '11.17.4' },
			'GET /auth': () => json({ data: [{ name: 'ldap', driver: 'ldap' }], disableDefault: false }),
		});
		const store = useServerStore();

		await store.hydrate();

		expect(calls(fetch).sort()).toEqual(['GET /auth?sessionOnly', 'GET /server/info']);
		expect(store.info.project).toEqual(project);
		expect(store.info.setupCompleted).toBe(true);
		expect(store.info.queryLimit).toEqual({ default: 100, max: -1 });
		expect(store.auth.providers).toEqual([{ name: 'ldap', driver: 'ldap' }]);
	});

	test('the Directus column defaults count as unset (D-51)', async () => {
		mockApi({
			'GET /server/info': { project: { project_name: 'Directus', project_color: '#6644FF', project_logo: 'l1' } },
			'GET /auth': () => json({ data: [], disableDefault: false }),
		});
		const store = useServerStore();

		await store.hydrate();

		expect(store.info.project).toEqual({ project_name: null, project_color: null, project_logo: 'l1' });
	});

	test('a missing project keeps null and does not throw (FR-037)', async () => {
		mockApi({ 'GET /server/info': {}, 'GET /auth': () => json({ data: [], disableDefault: false }) });
		const store = useServerStore();

		await store.hydrate();

		expect(store.info.project).toBeNull();
		expect(store.info.setupCompleted).toBe(false);
	});

	test('fails when /auth fails (error screen, FR-003)', async () => {
		mockApi({ 'GET /server/info': {}, 'GET /auth': () => json({ errors: [{ message: 'x' }] }, 500) });

		await expect(useServerStore().hydrate()).rejects.toBeTruthy();
	});

	test('rate limit info replaces the request queue', async () => {
		mockApi({
			'GET /server/info': { rateLimit: { points: 50, duration: 1 } },
			'GET /auth': () => json({ data: [], disableDefault: false }),
		});
		const before = requestQueue;

		await useServerStore().hydrate();

		const { requestQueue: after } = await import('../api/sdk.ts');
		expect(after).not.toBe(before);
	});

	test('dehydrate clears project and providers', async () => {
		const store = useServerStore();
		store.info.project = project as never;
		store.auth.providers = [{ name: 'x', driver: 'ldap' }];

		store.dehydrate();

		expect(store.info.project).toBeNull();
		expect(store.auth.providers).toEqual([]);
	});
});

describe('providerOptions', () => {
	test('adds the default provider first and leaves SSO drivers out', () => {
		const store = useServerStore();
		store.auth.providers = [
			{ name: 'ldap', driver: 'ldap' },
			{ name: 'github', driver: 'oauth2' },
			{ name: 'keycloak', driver: 'openid' },
			{ name: 'okta', driver: 'saml' },
		];

		expect(store.providerOptions).toEqual([
			{ text: 'Default', value: 'local', driver: 'default' },
			{ text: 'LDAP', value: 'ldap', driver: 'ldap' },
		]);
	});

	test('no default provider when disableDefault', () => {
		const store = useServerStore();
		store.auth.providers = [{ name: 'ldap', driver: 'ldap' }];
		store.auth.disableDefault = true;

		expect(store.providerOptions.map((o) => o.value)).toEqual(['ldap']);
	});
});
