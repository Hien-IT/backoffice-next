// Feature 016 T018 (FR-001, data-model §1): the routes of directus/app/src/modules/settings/index.ts in scope, the two
// data model guards, the flows routes of 017 (overview, flow page with its not-found guard, operation drawer) and the out-of-scope paths that fall to the module not-found page (D-93).
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import { useCollectionsStore } from '../stores/collections.ts';
import { useFlowsStore } from '../stores/flows.ts';
import { calls, mockApi } from '../test-utils/fetch.ts';
import settings from './settings.ts';

// router.push loads the lazy route components: stub them so the test only checks the route table.
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
vi.mock('./settings/routes/presets/PresetsCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/presets/PresetItemRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/translations/TranslationsCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/translations/TranslationItemRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/flows/FlowsOverviewRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/flows/FlowRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./settings/routes/flows/OperationDetail.vue', () => ({ default: { render: () => null } }));

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
			'/settings/extensions': 'settings-extensions',
		};

		for (const [path, name] of Object.entries(names)) expect((await go(path)).name, path).toBe(name);
	});

	test('out-of-scope paths are the module not-found page (D-93; marketplace until spec 020 wave 3)', async () => {
		for (const path of ['/settings/ai', '/settings/marketplace', '/settings/system-logs']) {
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

// Feature 017 (T032, T050, T061, FR-001): the flows overview, the flow page (a flow of the store, else the module
// not-found page) and the operation drawer as its child route (D-92 lifted).
test('/settings/flows/<id>(/<operation>): the flow page and the drawer for a stored flow, not found otherwise', async () => {
	useFlowsStore().flows = [{ id: '3f2a' } as never];
	const r = router();

	await r.push('/settings/flows/3f2a');
	expect(r.currentRoute.value.name).toBe('settings-flows-item');
	await r.push('/settings/flows/3f2a/+');
	expect(r.currentRoute.value.name).toBe('settings-flows-operation');
	expect(r.currentRoute.value.params).toEqual({ primaryKey: '3f2a', operationId: '+' });
	// beforeEnter runs when the route is entered (not on a param change), as in Directus.
	await r.push('/settings/flows');
	await r.push('/settings/flows/nope');
	expect(r.currentRoute.value.name).toBe('settings-not-found');
});

test('/settings/flows is the flows overview, not the 012 frame', async () => {
	const r = router();
	await r.push('/settings/flows');
	expect(r.currentRoute.value.name).toBe('settings-flows-collection');
	expect(r.currentRoute.value.matched.at(-1)!.meta).not.toHaveProperty('module');
});
