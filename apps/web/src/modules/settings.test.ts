// Feature 016 T018 (FR-001, data-model §1): the routes of directus/app/src/modules/settings/index.ts in scope, the two
// data model guards, the flows frame (D-92) and the out-of-scope paths that fall to the module not-found page (D-93).
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { useCollectionsStore } from '../stores/collections.ts';
import { calls, mockApi } from '../test-utils/fetch.ts';
import settings from './settings.ts';

// router.push loads the lazy route components: stub them so the test only checks the route table.
vi.mock('./ModulePlaceholder.vue', () => ({ default: { render: () => null } }));
vi.mock('./content/routes/ContentNotFound.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/data-model/CollectionsRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/data-model/NewCollection.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/data-model/FieldsRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/data-model/field-detail/FieldDetail.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/roles/RolesCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/roles/NewRole.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/roles/RoleItemRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/roles/RolePublicRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/policies/PoliciesCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/policies/NewPolicy.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/policies/PolicyItemRoute.vue', () => ({ default: { render: () => null } }));

function router() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/settings', children: settings.routes as RouteRecordRaw[], component: { render: () => null } }],
	});
}

async function go(path: string) {
	const r = router();
	await r.push(path);
	return r.currentRoute.value;
}

beforeEach(() => {
	setActivePinia(createPinia());
});

afterEach(() => vi.unstubAllGlobals());

describe('settings module routes', () => {
	test('in-scope routes keep the Directus names', async () => {
		mockApi({ 'GET /collections': [], 'GET /fields': [] });
		const names = {
			'/settings': 'settings-collections',
			'/settings/data-model/+': 'settings-add-new',
			'/settings/roles': 'settings-roles-collection',
			'/settings/roles/+': 'settings-add-new-role',
			'/settings/roles/public': 'settings-roles-public-item',
			'/settings/roles/3f2a': 'settings-roles-item',
			'/settings/policies': 'settings-policies-collection',
			'/settings/policies/+': 'settings-add-new-policy',
			'/settings/policies/3f2a': 'settings-policies-item',
			'/settings/project': 'settings-project',
			'/settings/appearance': 'settings-appearance',
			'/settings/presets': 'settings-presets-collection',
			'/settings/presets/+': 'settings-presets-item',
			'/settings/translations': 'settings-translations-collection',
			'/settings/translations/7': 'settings-translations-item',
			'/settings/flows': 'settings-flows-collection',
			'/settings/flows/3f2a': 'settings-flows-item',
		};

		for (const [path, name] of Object.entries(names)) expect((await go(path)).name, path).toBe(name);
	});

	test('out-of-scope paths are the module not-found page (D-93)', async () => {
		for (const path of ['/settings/ai', '/settings/extensions', '/settings/marketplace', '/settings/system-logs']) {
			const route = await go(path);

			expect(route.name, path).toBe('settings-not-found');
			expect(route.matched.at(-1)!.props['default']).toEqual({ module: 'settings' });
		}
	});

	test('the collection list hydrates the collections store on the way in', async () => {
		const fetch = mockApi({ 'GET /collections': [] });

		await go('/settings/data-model');

		expect(calls(fetch)).toEqual(['GET /collections']);
	});

	test('a collection page: unknown collection → not-found; a table without meta gets meta {} first; fields hydrate', async () => {
		const fetch = mockApi({ 'PATCH /collections/raw': {}, 'GET /fields': [], 'GET /collections': [] });
		const collectionsStore = useCollectionsStore();
		collectionsStore.collections = [
			{ collection: 'articles', meta: { icon: 'box' }, schema: {} },
			{ collection: 'raw', meta: null, schema: {} },
		].map((c) => collectionsStore.prepareCollectionForApp(c as never));

		const missing = await go('/settings/data-model/nope');
		expect(missing.name).toBe('settings-not-found');
		expect(missing.params['_']).toEqual(['settings', 'data-model', 'nope']);

		const raw = await go('/settings/data-model/raw');
		expect(raw.name).toBe('settings-fields');
		expect(calls(fetch)).toContain('PATCH /collections/raw');
		expect(JSON.parse(fetch.mock.calls.find(([, init]) => init?.method === 'PATCH')![1]!.body as string)).toEqual({
			meta: {},
		});

		const field = await go('/settings/data-model/articles/title?type=m2o');
		expect(field.name).toBe('settings-fields-field');
		const props = field.matched.find((m) => m.name === 'settings-fields')!.props['default'] as (
			r: typeof field,
		) => unknown;
		expect(props(field)).toEqual({ collection: 'articles', field: 'title', type: 'm2o' });
	});

	test('admins only (preRegisterCheck as in 012)', () => {
		expect(settings.preRegisterCheck!({ admin_access: true } as never, {} as never)).toBe(true);
		expect(settings.preRegisterCheck!({ admin_access: false } as never, {} as never)).toBe(false);
	});
});
