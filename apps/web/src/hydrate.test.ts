import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { dehydrate, hydrate } from './hydrate.ts';
import { useAppStore } from './stores/app.ts';
import { useFieldsStore } from './stores/fields.ts';
import { useFlowsStore } from './stores/flows.ts';
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
	// No read permission on directus_flows: the flows store stays empty without a request (FR-057).
	expect(order).not.toContain('GET /flows');
	expect(onHydrateModules).toHaveBeenCalled();
	expect(setLanguage).toHaveBeenCalledWith('vi-VN');
	expect(useAppStore().hydrated).toBe(true);
	expect(useSettingsStore().settings).toEqual({ module_bar: null });
});

test('loads the flows after the permissions when directus_flows is readable; a failure keeps it empty', async () => {
	const flows = [{ id: 'f1', status: 'active', trigger: 'manual', options: { collections: ['a'] } }];
	const permissions = { directus_flows: { read: { access: 'full' } } };
	let fetch = mockApi({ ...answers(true), 'GET /permissions/me': permissions, 'GET /flows': flows });

	await hydrate();

	const order = calls(fetch);
	expect(order).toContain('GET /flows?fields=*,operations.*&limit=-1');
	expect(order.map(path).indexOf('GET /flows')).toBeGreaterThan(order.map(path).indexOf('GET /permissions/me'));
	expect(useFlowsStore().flows).toEqual(flows);

	await dehydrate();
	expect(useFlowsStore().flows).toEqual([]);

	fetch = mockApi({
		...answers(true),
		'GET /permissions/me': permissions,
		'GET /flows': () => json({ errors: [{ message: 'boom' }] }, 500),
	});
	await hydrate();

	expect(calls(fetch).map(path)).toContain('GET /flows');
	expect(useFlowsStore().flows).toEqual([]);
	expect(useAppStore().error).toBeNull();
});

test('fields are not translated during hydrate; setLanguage translates them afterwards (like Directus)', async () => {
	mockApi({ ...answers(true), 'GET /fields': [{ collection: 'a', field: 'title', meta: { note: '$t:save' } }] });

	await hydrate();

	expect(useFieldsStore().getField('a', 'title')?.meta?.note).toBe('$t:save');
	expect(setLanguage).toHaveBeenCalledWith('vi-VN');
});

test('a user without app_access loads nothing else (no-app-access screen)', async () => {
	const fetch = mockApi(answers(false));

	await hydrate();

	expect(calls(fetch).map(path).sort()).toEqual(['GET /policies/me/globals', 'GET /roles/me', 'GET /users/me']);
	expect(onHydrateModules).not.toHaveBeenCalled();
	expect(setLanguage).toHaveBeenCalled();
});

test('a share session loads the stores of shared.vue and the modules (FR-084)', async () => {
	const fetch = mockApi({ ...answers(false), 'GET /users/me': { share: 's1' } });

	await hydrate();

	expect(calls(fetch).map(path)).toEqual([
		'GET /users/me',
		'GET /policies/me/globals',
		'GET /roles/me',
		'GET /collections',
		'GET /permissions/me',
		'GET /fields',
		'GET /relations',
	]);
	expect(onHydrateModules).toHaveBeenCalled();
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
