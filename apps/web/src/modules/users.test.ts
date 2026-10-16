// Feature 015 (FR-050, data-model §1, D-86): the routes of directus/app/src/modules/users/index.ts, without /users/me (D-86).
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router';
import users from './users.ts';

// router.push loads the lazy route components; their module graph took over 5 s on a loaded CI runner.
vi.mock('./users/routes/UsersCollectionRoute.vue', () => ({ default: { render: () => null } }));
vi.mock('./users/routes/UserItemRoute.vue', () => ({ default: { render: () => null } }));

function router() {
	return createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/users', children: users.routes as RouteRecordRaw[], component: { render: () => null } }],
	});
}

async function resolve(path: string) {
	const r = router();
	await r.push(path);
	return r.currentRoute.value;
}

const propsOf = (route: Awaited<ReturnType<typeof resolve>>) => {
	const props = route.matched.at(-1)!.props['default'];
	return typeof props === 'function' ? props(route) : props;
};

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('users module routes', () => {
	test('status lists pass `status`; all has none', async () => {
		expect((await resolve('/users')).name).toBe('users-active');
		expect(propsOf(await resolve('/users'))).toEqual({ status: 'active' });
		expect(propsOf(await resolve('/users/suspended'))).toEqual({ status: 'suspended' });
		expect(propsOf(await resolve('/users/invited'))).toEqual({ status: 'invited' });
		expect((await resolve('/users/all')).name).toBe('users-all');
		expect(propsOf(await resolve('/users/all'))).toEqual({});
	});

	test('roles: /users/roles redirects; a role lists its users; + adds a user with the role', async () => {
		expect((await resolve('/users/roles')).fullPath).toBe('/users');

		const list = await resolve('/users/roles/r1');
		expect(list.name).toBe('roles-collection');
		expect(list.params['role']).toBe('r1');

		const add = await resolve('/users/roles/r1/+');
		expect(add.name).toBe('roles-item-add');
		expect(propsOf(add)).toEqual({ primaryKey: '+', role: 'r1' });
	});

	test('/users/me has no route of its own: "me" is a user key, as Directus (D-86)', async () => {
		const me = await resolve('/users/me');
		expect(me.name).toBe('users-item');
		expect(me.params['primaryKey']).toBe('me');
	});

	test('a key opens the user (+ is a new user); deeper paths are the module not-found page', async () => {
		const item = await resolve('/users/abc');
		expect(item.name).toBe('users-item');
		expect(item.params['primaryKey']).toBe('abc');
		expect((await resolve('/users/+')).params['primaryKey']).toBe('+');

		const missing = await resolve('/users/abc/def');
		expect(missing.name).toBe('users-not-found');
		expect(propsOf(missing)).toEqual({ module: 'users' });
	});

	test('module entry: id, icon, name and the read check of directus_users', () => {
		expect(users).toMatchObject({ id: 'users', icon: 'people_alt', name: '$t:user_directory' });
		const check = users.preRegisterCheck!;
		expect(check({ admin_access: false } as never, { directus_users: { read: { access: 'full' } } } as never)).toBe(true);
		expect(check({ admin_access: false } as never, {} as never)).toBe(false);
		expect(check({ admin_access: true } as never, {} as never)).toBe(true);
	});
});
