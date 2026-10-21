import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';
import { usePermissionsStore } from '../stores/permissions.ts';
import { mockApi } from '../test-utils/fetch.ts';
import { useUserStore } from '../stores/user.ts';
import type { AppUser } from '../types/user.ts';

const { router } = vi.hoisted(() => ({ router: { value: null as unknown } }));

vi.mock('../router/index.ts', () => ({
	get router() {
		return router.value;
	},
}));
vi.mock('../lang/set-language.ts', () => ({ setLanguage: vi.fn() }));

const { getInternalModules, registerModules } = await import('./index.ts');

beforeEach(() => {
	setActivePinia(createPinia());
	router.value = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/', component: { render: () => null } }],
	});
});

const ids = (modules: { id: string }[]) => modules.map((m) => m.id);

function setUser(admin: boolean, permissions: Record<string, unknown>) {
	useUserStore().currentUser = { id: 'u1', admin_access: admin, app_access: true } as AppUser;
	usePermissionsStore().permissions = permissions as never;
}

describe('getInternalModules', () => {
	test('six modules sorted by id, with Directus names and icons', () => {
		const modules = getInternalModules();

		expect(modules.map((m) => [m.id, m.name, m.icon, m.hidden ?? false])).toEqual([
			['activity', '$t:activity', 'notifications', true],
			['content', '$t:content', 'box', false],
			['files', '$t:file_library', 'folder', false],
			['insights', '$t:insights', 'insights', false],
			['settings', '$t:settings', 'settings', false],
			['users', '$t:user_directory', 'people_alt', false],
		]);
	});
});

describe('registerModules (FR-022)', () => {
	test.each([
		['admin', true, {}, ['activity', 'content', 'files', 'insights', 'settings', 'users']],
		[
			'partial',
			false,
			{
				directus_files: { read: { access: 'partial' } },
				directus_users: { read: { access: 'full' } },
				directus_dashboards: { read: { access: 'none' } },
			},
			['activity', 'content', 'files', 'users'],
		],
		['none', false, {}, ['activity', 'content']],
	])('%s user', async (_name, admin, permissions, expected) => {
		setUser(admin, permissions);
		const { registeredModules, onHydrateModules } = registerModules(getInternalModules());

		await onHydrateModules();

		expect(ids(registeredModules.value)).toEqual(expected);
	});

	test('adds a route per registered module and removes them on dehydrate', async () => {
		setUser(false, {});
		const r = router.value as ReturnType<typeof createRouter>;
		const { onHydrateModules, onDehydrateModules, registeredModules } = registerModules(getInternalModules());

		await onHydrateModules();
		expect(r.hasRoute('content')).toBe(true);
		expect(r.hasRoute('settings')).toBe(false);
		// Feature 014: the Content module routes of Directus (collection, item).
		expect(r.resolve('/content/articles/1').matched.map((m) => m.name)).toEqual(['content', undefined, 'content-item']);
		expect(r.resolve('/activity').matched.map((m) => m.name)).toEqual(['activity', 'activity-collection']);

		await onDehydrateModules();
		expect(r.hasRoute('content')).toBe(false);
		expect(registeredModules.value).toEqual([]);
	});

	test('users/me is a user key (feature 015, D-86), settings redirects to the data model list (016)', async () => {
		setUser(true, {});
		const r = router.value as ReturnType<typeof createRouter>;
		const { onHydrateModules } = registerModules(getInternalModules());

		await onHydrateModules();

		expect(r.resolve('/users/me').name).toBe('users-item');
		expect(r.resolve('/users/3f2a').name).toBe('users-item');
		mockApi({ 'GET /collections': [] });
		await r.push('/settings');
		expect(r.currentRoute.value.fullPath).toBe('/settings/data-model');
		expect(r.currentRoute.value.name).toBe('settings-collections');
	});

	test('no user: nothing registered', async () => {
		const { registeredModules, onHydrateModules } = registerModules(getInternalModules());
		await onHydrateModules();
		expect(registeredModules.value).toEqual([]);
	});

	test('extension modules: preRegisterCheck applies, a duplicate id keeps the internal one (R-67)', async () => {
		setUser(false, {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const ext = (id: string, allowed: boolean) =>
			({ id, name: id, icon: 'box', routes: [], preRegisterCheck: () => allowed }) as never;
		const { registeredModules, onHydrateModules, setModules, getModules } = registerModules([]);
		const content = getInternalModules().find((m) => m.id === 'content')!;
		setModules([content, ext('report', true), ext('hidden-report', false), ext('content', true)]);

		expect(ids(getModules())).toEqual(['content', 'report', 'hidden-report']);
		expect(getModules()[0]).toBe(content);
		expect(warn).toHaveBeenCalledWith('Module "content" is already registered');

		await onHydrateModules();
		expect(ids(registeredModules.value)).toContain('report');
		expect(ids(registeredModules.value)).not.toContain('hidden-report');
		expect((router.value as ReturnType<typeof createRouter>).hasRoute('report')).toBe(true);
		warn.mockRestore();
	});
});
