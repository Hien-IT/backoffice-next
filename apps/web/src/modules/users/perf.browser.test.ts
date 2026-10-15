// Feature 015 T097 (SC-007, CHK044 to CHK046): opening the user page sends exactly the requests of the SC-007 table, in
// chromium with the production Vue build (runs with PERF=1 only, vitest.config.ts). The app session is already up
// (user, fields, relations, collections, permissions hydrated), so only the requests of the page itself are counted.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../api/sdk.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { usePermissionsStore } from '../../stores/permissions.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useServerStore } from '../../stores/server.ts';
import { useUserStore } from '../../stores/user.ts';
import '../../styles/index.css';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import { mountLayout } from '../../test-utils/layout.ts';
import { resetNavigationForTests } from './composables/use-navigation.ts';
import UserItemRoute from './routes/UserItemRoute.vue';

// 1×1 PNG: the avatar and the file thumbnail load without a request to the fake API host.
vi.mock('../../utils/get-asset-url.ts', () => ({
	getAssetUrl: () =>
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
}));

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

beforeEach(async () => {
	resetNavigationForTests();
	await replaceQueue();
});

// The fixture snapshot has no system relations (fetch.ts keeps `role` and `avatar` out of GET /relations) and no
// fields of directus_access, directus_policies or directus_roles; Directus answers them on every instance. Added here
// as directus/packages/system-data/src (relations.yaml, fields/access.yaml), so the form's Role, Avatar and Policies
// fields are wired as in the real app.
function field(collection: string, name: string, type: string, primary = false) {
	return {
		collection,
		field: name,
		type,
		schema: { name, table: collection, data_type: type, is_primary_key: primary, is_nullable: !primary },
		meta: { system: true, collection, field: name, hidden: true, special: null, interface: null, options: null },
	};
}

const SYSTEM_FIELDS = [
	...['id', 'role', 'user', 'policy'].map((name) => field('directus_access', name, 'uuid', name === 'id')),
	field('directus_access', 'sort', 'integer'),
	field('directus_policies', 'id', 'uuid', true),
	field('directus_policies', 'name', 'string'),
	field('directus_roles', 'id', 'uuid', true),
	field('directus_roles', 'name', 'string'),
];

const SYSTEM_COLLECTIONS = ['directus_access', 'directus_policies', 'directus_roles'].map((collection) => ({
	collection,
	meta: { collection, hidden: false, singleton: false, icon: null, system: true, accountability: 'all' },
	schema: { name: collection },
}));

function relation(collection: string, name: string, related: string, meta: Record<string, unknown> = {}) {
	return {
		collection,
		field: name,
		related_collection: related,
		schema: { table: collection, column: name, foreign_key_table: related, foreign_key_column: 'id' },
		meta: {
			many_collection: collection,
			many_field: name,
			one_collection: related,
			one_field: null,
			junction_field: null,
			sort_field: null,
			one_deselect_action: 'nullify',
			...meta,
		},
	};
}

const SYSTEM_RELATIONS = [
	relation('directus_users', 'role', 'directus_roles', { one_field: 'users' }),
	relation('directus_users', 'avatar', 'directus_files'),
	relation('directus_access', 'user', 'directus_users', {
		one_field: 'policies',
		junction_field: 'policy',
		sort_field: 'sort',
		one_deselect_action: 'delete',
	}),
	relation('directus_access', 'policy', 'directus_policies', {
		one_field: 'users',
		junction_field: 'user',
		one_deselect_action: 'delete',
	}),
];

const routes: RouteRecordRaw[] = [
	{ path: '/users/:primaryKey', name: 'users-item', component: { render: () => null } },
	{ path: '/users', name: 'users-active', component: { render: () => null } },
	{ path: '/users/roles/:role', name: 'roles-collection', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

test('the user page sends the item, policies, avatar and role requests, and no roles list', async () => {
	const snapshot = loadSnapshot();
	// No fixture user has an avatar: give one the bo-files PNG (bo-27).
	const user = snapshot.directoryUsers.find((u) => u['email'] === 'bo-active@example.com')!;
	user['avatar'] = 'bo-27';
	let fetch!: ReturnType<typeof mockFixtureApi>;
	let before = 0;

	await mountLayout(UserItemRoute, {
		props: { primaryKey: user['id'] },
		routes,
		path: `/users/${user['id']}`,
		async beforeMount() {
			fetch = mockFixtureApi(snapshot, {
				user: 'admin',
				answers: {
					'GET /collections': [...snapshot.systemCollections, ...snapshot.collections, ...SYSTEM_COLLECTIONS],
					'GET /fields': [...snapshot.systemFields, ...snapshot.fields, ...SYSTEM_FIELDS],
					'GET /relations': [...snapshot.relations, ...SYSTEM_RELATIONS],
					// The user has no policy.
					'GET /access': ({ url }: { url: URL }) =>
						json({ data: url.search.includes('aggregate') ? [{ count: { id: 0 } }] : [] }),
				},
			});
			await useUserStore().hydrate();
			await Promise.all([
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
				usePermissionsStore().hydrate(),
			]);
			useServerStore().info.queryLimit = { default: 100, max: -1 };
			before = calls(fetch).length;
		},
	});

	const role = user['role'] as string;
	// SC-007 lists 1 item, 0 roles (the roles list is cached), 1 /access and 1 /files. The code sends, as Directus:
	// - /access twice: list-m2m (use-relation-multiple) reads the page of policies and their count (aggregate);
	// - /files/<avatar> twice: the `file` interface (use-relation-single) and the template data of its inactive
	//   DrawerItem (use-template-data, directus_files display template);
	// - /roles/<role> once: select-dropdown-m2o (use-relation-single) reads the role it shows; GET /roles is not sent.
	const expected = [
		`GET /users/${user['id']}`,
		'GET /access',
		'GET /access',
		'GET /files/bo-27',
		'GET /files/bo-27',
		`GET /roles/${role}`,
	].sort();
	const sent = () => calls(fetch).slice(before);
	const paths = () =>
		sent()
			.map((call) => call.split('?')[0]!)
			.sort();

	await vi.waitFor(() => expect(paths()).toEqual(expected), { timeout: 5000 });
	// Nothing more arrives once the page has settled.
	await new Promise((resolve) => setTimeout(resolve, 500));
	await flushPromises();

	// eslint-disable-next-line no-console
	console.log(`SC-007 user page requests:\n${sent().join('\n')}`);
	expect(paths()).toEqual(expected);
	expect(sent()).toContain(`GET /users/${user['id']}?fields=*,role.*,avatar.id,avatar.modified_on`);
	assertOnlyKnownRequests(sent());
	// The form's relational fields are wired (no "relationship is not configured" notice).
	expect(document.querySelector('main')!.textContent).not.toContain('not configured');
});
