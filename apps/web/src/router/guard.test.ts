import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteLocationNormalized, type Router } from 'vue-router';
import { useAppStore } from '../stores/app.ts';
import { useServerStore } from '../stores/server.ts';
import { useUserStore } from '../stores/user.ts';
import type { AppUser } from '../types/user.ts';
import { _resetState, onAfterEach, onBeforeEach } from './guard.ts';

const { refresh, hydrate } = vi.hoisted(() => ({ refresh: vi.fn(), hydrate: vi.fn() }));

vi.mock('../auth.ts', () => ({ refresh }));
vi.mock('../hydrate.ts', () => ({ hydrate }));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

const { defaultRoutes } = await import('./index.ts');

let router: Router;

beforeEach(() => {
	setActivePinia(createPinia());
	_resetState();
	vi.clearAllMocks();
	localStorage.clear();

	const server = useServerStore();
	server.info.project = { project_name: null } as never;
	server.info.setupCompleted = true;

	router = createRouter({
		history: createMemoryHistory('/admin/'),
		routes: [...defaultRoutes, { name: 'content', path: '/content/:p(.*)*', component: { render: () => null } }],
	});
	router.beforeEach(onBeforeEach);
});

afterEach(() => vi.useRealTimers());

const user = (fields: Partial<AppUser>) =>
	({ id: 'u1', tfa_secret: null, enforce_tfa: false, last_page: '/content/last', ...fields }) as AppUser;

function signIn(currentUser: AppUser | { share: string; app_access: boolean; admin_access: boolean }) {
	const appStore = useAppStore();
	appStore.authenticated = true;
	hydrate.mockImplementation(async () => {
		useUserStore().currentUser = currentUser;
		appStore.hydrated = true;
	});
}

async function go(path: string) {
	await router.push(path);
	return router.currentRoute.value.fullPath;
}

describe('onBeforeEach', () => {
	test('first load refreshes once without navigation, ignoring errors', async () => {
		refresh.mockRejectedValueOnce(new Error('no session'));

		await go('/login');
		await go('/reset-password');

		expect(refresh).toHaveBeenCalledTimes(1);
		expect(refresh).toHaveBeenCalledWith({ navigate: false });
	});

	test('loads server info when missing; an error becomes appStore.error', async () => {
		const server = useServerStore();
		server.info.project = null;
		const error = new Error('down');
		vi.spyOn(server, 'hydrate').mockRejectedValue(error);

		await go('/login');

		expect(server.hydrate).toHaveBeenCalled();
		expect(useAppStore().error).toBe(error);
	});

	test('setup not completed: every route goes to /setup', async () => {
		useServerStore().info.setupCompleted = false;

		expect(await go('/login')).toBe('/setup');
		expect(await go('/content')).toBe('/setup');
	});

	test('setup completed: / goes to /login and /setup to /login', async () => {
		expect(await go('/')).toBe('/login');
		expect(await go('/setup')).toBe('/login');
	});

	test('private route while signed out goes to /login?redirect=', async () => {
		expect(await go('/settings/project')).toBe('/login?redirect=/settings/project');
		expect(hydrate).not.toHaveBeenCalled();
	});

	test('private route while signed in hydrates then continues', async () => {
		signIn(user({}));

		expect(await go('/content/articles')).toBe('/content/articles');
		expect(hydrate).toHaveBeenCalledTimes(1);
	});

	test('public routes never hydrate', async () => {
		signIn(user({}));
		await go('/login');
		expect(hydrate).not.toHaveBeenCalled();
	});

	test('enforce_tfa without secret forces /tfa-setup with the redirect', async () => {
		signIn(user({ enforce_tfa: true }));

		expect(await go('/content/a')).toBe('/tfa-setup?redirect=/content/a');
		expect(await go('/content/last')).toBe('/tfa-setup');
	});

	test('a TFA setup asked in localStorage forces /tfa-setup', async () => {
		localStorage.setItem('backoffice-require_tfa_setup', 'u1');
		signIn(user({}));

		expect(await go('/content/a')).toBe('/tfa-setup?redirect=/content/a');
	});

	test('/tfa-setup with a secret goes back to last_page (on first hydrate and after)', async () => {
		signIn(user({ tfa_secret: 'x' }));
		expect(await go('/tfa-setup')).toBe('/content/last');

		expect(await go('/tfa-setup')).toBe('/content/last');

		useUserStore().currentUser = user({ tfa_secret: 'x', last_page: null });
		expect(await go('/tfa-setup')).toBe('/login');
	});

	test('share users are never forced to TFA', async () => {
		signIn({ share: 's1', app_access: false, admin_access: false });

		expect(await go('/content/a')).toBe('/content/a');
	});
});

describe('onAfterEach', () => {
	const to = (meta: Record<string, unknown>) =>
		({ fullPath: '/files', path: '/files', meta }) as unknown as RouteLocationNormalized;

	test('tracks private routes after 500 ms, only the last one', () => {
		vi.useFakeTimers();
		const userStore = useUserStore();
		const trackPage = vi.spyOn(userStore, 'trackPage').mockResolvedValue();

		onAfterEach(to({}), to({}));
		onAfterEach(to({}), to({}));
		vi.advanceTimersByTime(499);
		expect(trackPage).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1);
		expect(trackPage).toHaveBeenCalledTimes(1);
	});

	test('a failed track (401 after deleting yourself) is caught', async () => {
		vi.useFakeTimers();
		const trackPage = vi.spyOn(useUserStore(), 'trackPage').mockRejectedValue({ errors: [] });

		onAfterEach(to({}), to({}));
		vi.advanceTimersByTime(500);

		await expect(trackPage.mock.results[0]!.value).rejects.toEqual({ errors: [] });
	});

	test('skips public routes and track: false', () => {
		vi.useFakeTimers();
		const trackPage = vi.spyOn(useUserStore(), 'trackPage').mockResolvedValue();

		onAfterEach(to({ public: true }), to({}));
		onAfterEach(to({ track: false }), to({}));
		vi.advanceTimersByTime(1000);

		expect(trackPage).not.toHaveBeenCalled();
	});
});
