import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { dehydrate, hydrate } from './hydrate.ts';
import { useAppStore } from './stores/app.ts';
import { useSettingsStore } from './stores/settings.ts';
import { useUserStore } from './stores/user.ts';
import { calls, json, mockApi } from './test-utils/fetch.ts';

const { setLanguage, onHydrateModules, onDehydrateModules } = vi.hoisted(() => ({
	setLanguage: vi.fn(),
	onHydrateModules: vi.fn(),
	onDehydrateModules: vi.fn(),
}));

vi.mock('./lang/set-language.ts', () => ({ setLanguage }));
vi.mock('./modules/index.ts', () => ({ onHydrateModules, onDehydrateModules }));

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

afterEach(() => vi.unstubAllGlobals());

const answers = (appAccess: boolean) => ({
	'GET /users/me': { id: 'u1', role: { id: 'r1' }, language: 'vi-VN' },
	'GET /policies/me/globals': { app_access: appAccess, admin_access: false, enforce_tfa: false },
	'GET /roles/me': [{ id: 'r1' }],
	'GET /permissions/me': {},
	'GET /fields': [],
	'GET /settings': { module_bar: null },
	'GET /collections': [],
	'GET /relations': [],
	'GET /presets': [],
	'GET /notifications': [{ count: { id: 0 } }],
});

const path = (call: string) => call.split('?')[0]!;

test('loads the user first, then permissions and fields, then the other stores (FR-016)', async () => {
	const fetch = mockApi(answers(true));

	await hydrate();

	const order = calls(fetch).map(path);
	const index = (p: string) => order.indexOf(p);

	expect(order.slice(0, 3).sort()).toEqual(['GET /policies/me/globals', 'GET /roles/me', 'GET /users/me']);
	expect(index('GET /permissions/me')).toBeGreaterThan(2);
	expect(index('GET /fields')).toBeGreaterThan(2);

	for (const later of ['GET /settings', 'GET /collections', 'GET /relations', 'GET /presets', 'GET /notifications']) {
		expect(index(later)).toBeGreaterThan(Math.max(index('GET /permissions/me'), index('GET /fields')));
	}

	expect(order).not.toContain('GET /server/info');
	expect(onHydrateModules).toHaveBeenCalled();
	expect(setLanguage).toHaveBeenCalledWith('vi-VN');
	expect(useAppStore().hydrated).toBe(true);
	expect(useSettingsStore().settings).toEqual({ module_bar: null });
});

test('a user without app_access loads nothing else (no-app-access screen)', async () => {
	const fetch = mockApi(answers(false));

	await hydrate();

	expect(calls(fetch).map(path).sort()).toEqual(['GET /policies/me/globals', 'GET /roles/me', 'GET /users/me']);
	expect(onHydrateModules).not.toHaveBeenCalled();
	expect(setLanguage).toHaveBeenCalled();
});

test('an error of a store becomes appStore.error', async () => {
	mockApi({ ...answers(true), 'GET /fields': () => json({ errors: [{ message: 'boom' }] }, 500) });

	await hydrate();

	const appStore = useAppStore();
	expect(appStore.error).toMatchObject({ errors: [{ message: 'boom' }] });
	expect(appStore.hydrating).toBe(false);
	expect(appStore.hydrated).toBe(true);
});

test('runs once; dehydrate clears the stores and the modules', async () => {
	const fetch = mockApi(answers(true));
	await hydrate();
	fetch.mockClear();

	await hydrate();
	expect(fetch).not.toHaveBeenCalled();

	await dehydrate();
	expect(useUserStore().currentUser).toBeNull();
	expect(useSettingsStore().settings).toBeNull();
	expect(onDehydrateModules).toHaveBeenCalled();
	expect(useAppStore().hydrated).toBe(false);

	await dehydrate();
	expect(onDehydrateModules).toHaveBeenCalledTimes(1);
});
