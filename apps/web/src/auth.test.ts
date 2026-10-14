import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { _resetState, login, logout, LogoutReason, refresh } from './auth.ts';
import { emitter, Events } from './events.ts';
import { useAppStore } from './stores/app.ts';
import { calls, json, mockApi } from './test-utils/fetch.ts';

const { hydrate, dehydrate, push, serverHydrate } = vi.hoisted(() => ({
	hydrate: vi.fn(),
	dehydrate: vi.fn(),
	push: vi.fn(),
	serverHydrate: vi.fn(),
}));

vi.mock('./hydrate.ts', () => ({ hydrate, dehydrate }));
vi.mock('./router/index.ts', () => ({ router: { push } }));
vi.mock('./stores/server.ts', () => ({ useServerStore: () => ({ hydrate: serverHydrate }) }));

const session = { 'POST /auth/refresh': { expires: 900000 }, 'POST /auth/logout': null };

beforeEach(() => {
	setActivePinia(createPinia());
	_resetState();
	vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

describe('login', () => {
	test('local: POST /auth/login with mode session, then hydrate', async () => {
		const fetch = mockApi({ 'POST /auth/login': { expires: 900000 }, ...session });
		const appStore = useAppStore();

		await login({ credentials: { email: 'a@b.c', password: 'pw', otp: '123456' }, provider: 'local' });

		expect(calls(fetch)).toEqual(['POST /auth/login']);
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
			email: 'a@b.c',
			password: 'pw',
			otp: '123456',
			mode: 'session',
		});
		expect(appStore.authenticated).toBe(true);
		expect(appStore.accessTokenExpiry).toBeGreaterThan(Date.now());
		expect(serverHydrate).toHaveBeenCalled();
		expect(hydrate).toHaveBeenCalled();
	});

	test('LDAP: identifier to /auth/login/<provider>, then /auth/refresh', async () => {
		const fetch = mockApi({ 'POST /auth/login/ldap': { expires: null }, ...session });

		await login({ credentials: { identifier: 'ada', password: 'pw' }, provider: 'ldap' });

		expect(calls(fetch)).toEqual(['POST /auth/login/ldap', 'POST /auth/refresh']);
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
			identifier: 'ada',
			password: 'pw',
			mode: 'session',
		});
	});

	test('share: POST /shares/auth with mode session, then /auth/refresh', async () => {
		const fetch = mockApi({ 'POST /shares/auth': {}, ...session });

		await login({ credentials: { share: 's1', password: 'pw' }, share: true });

		expect(calls(fetch)).toEqual(['POST /shares/auth', 'POST /auth/refresh']);
		expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
			share: 's1',
			password: 'pw',
			mode: 'session',
		});
	});

	test('missing data throws', async () => {
		mockApi({});
		await expect(login({ credentials: {}, share: true })).rejects.toThrow('Missing share ID');
		await expect(login({ credentials: { email: 'a@b.c' } })).rejects.toThrow('Missing password');
		await expect(login({ credentials: { password: 'x' } })).rejects.toThrow('Missing email or identifier');
	});

	test('API errors reach the caller (translated by the form)', async () => {
		mockApi({
			'POST /auth/login': () => json({ errors: [{ message: 'x', extensions: { code: 'INVALID_OTP' } }] }, 401),
		});

		await expect(login({ credentials: { email: 'a@b.c', password: 'pw' } })).rejects.toMatchObject({
			errors: [{ extensions: { code: 'INVALID_OTP' } }],
		});
	});
});

describe('refresh', () => {
	test('first load: /auth/refresh sets the expiry', async () => {
		const fetch = mockApi(session);
		const appStore = useAppStore();

		await refresh();

		expect(calls(fetch)).toEqual(['POST /auth/refresh']);
		expect(appStore.authenticated).toBe(true);
	});

	test('fresh token: only validates the session with /users/me?fields=id', async () => {
		const fetch = mockApi({ 'GET /users/me': { id: 'u1' } });
		const appStore = useAppStore();
		appStore.authenticated = true;
		appStore.accessTokenExpiry = Date.now() + 60_000;

		await refresh();

		expect(calls(fetch)).toEqual(['GET /users/me?fields=id']);
	});

	test('failure logs out with SESSION_EXPIRED without calling /auth/logout', async () => {
		const fetch = mockApi({ 'POST /auth/refresh': () => json({ errors: [{ message: 'x' }] }, 401) });

		await refresh();

		expect(calls(fetch)).toEqual(['POST /auth/refresh']);
		expect(dehydrate).toHaveBeenCalled();
		expect(push).toHaveBeenCalledWith({ path: '/login', query: { reason: 'SESSION_EXPIRED' } });
	});

	test('first load without navigation does not push', async () => {
		mockApi({});
		await refresh({ navigate: false });
		expect(push).not.toHaveBeenCalled();
	});

	test('after the first refresh, does nothing when signed out', async () => {
		const fetch = mockApi(session);
		await refresh();
		useAppStore().authenticated = false;
		fetch.mockClear();

		await refresh();

		expect(fetch).not.toHaveBeenCalled();
	});
});

describe('logout', () => {
	test('SIGN_OUT calls /auth/logout and goes to /login?reason=SIGN_OUT', async () => {
		const fetch = mockApi(session);
		const appStore = useAppStore();
		appStore.authenticated = true;

		await logout();

		expect(calls(fetch)).toEqual(['POST /auth/logout']);
		expect(appStore.authenticated).toBe(false);
		expect(push).toHaveBeenCalledWith({ path: '/login', query: { reason: 'SIGN_OUT' } });
	});

	test('SIGN_OUT ignores a failing /auth/logout (already signed out)', async () => {
		mockApi({ 'POST /auth/logout': () => json({ errors: [{ message: 'x' }] }, 401) });
		await logout({ reason: LogoutReason.SIGN_OUT, navigate: false });
		expect(push).not.toHaveBeenCalled();
	});
});

describe('events', () => {
	test('sessionExpired logs out once while authenticated', async () => {
		const fetch = mockApi({});
		const appStore = useAppStore();

		emitter.emit(Events.sessionExpired);
		expect(dehydrate).not.toHaveBeenCalled();

		appStore.authenticated = true;
		emitter.emit(Events.sessionExpired);
		await vi.waitFor(() => expect(push).toHaveBeenCalledWith({ path: '/login', query: { reason: 'SESSION_EXPIRED' } }));
		expect(fetch).not.toHaveBeenCalled();
	});

	test('tab idle stops refreshing, tab active refreshes again', async () => {
		const fetch = mockApi(session);
		emitter.emit(Events.tabActive);
		expect(fetch).not.toHaveBeenCalled();

		emitter.emit(Events.tabIdle);
		emitter.emit(Events.tabActive);

		await vi.waitFor(() => expect(calls(fetch)).toEqual(['POST /auth/refresh']));
	});
});
