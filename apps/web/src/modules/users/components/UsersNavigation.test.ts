// Feature 015 (FR-052, FR-053, D-85): directus/app/src/modules/users/components/navigation.vue and NavigationRole.vue
// (no DR test): the four status links, the divider and skeleton, the role tree with its keyboard, and the admin
// "edit role" menu to /settings/roles/:id.
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { i18n } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';
import { mockApi } from '../../../test-utils/fetch.ts';
import { mountLayout, press } from '../../../test-utils/layout.ts';
import users from '../../users.ts';
import { resetNavigationForTests } from '../composables/use-navigation.ts';
import UsersNavigation from './UsersNavigation.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.unstubAllGlobals());

const t = (key: string, values?: Record<string, unknown>) => i18n.global.t(key, values ?? {});

const ROLES = [
	{ id: 'a', name: 'Admins', icon: 'verified', parent: null },
	{ id: 'b', name: 'Editors', icon: 'edit', parent: null },
	{ id: 'c', name: 'Juniors', icon: 'child_care', parent: 'b' },
];

beforeEach(async () => {
	resetNavigationForTests();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{
		path: '/users',
		component: { render: () => null },
		children: (users.routes as RouteRecordRaw[]).map((route) =>
			'redirect' in route && route.redirect ? route : ({ ...route, component: { render: () => null } } as RouteRecordRaw),
		),
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(props: Record<string, unknown> = {}, { admin = true, path = '/users', roles = ROLES } = {}) {
	const mounted = await mountLayout(UsersNavigation, {
		props,
		path,
		routes,
		beforeMount() {
			mockApi({ 'GET /roles': roles });
			useUserStore().currentUser = { id: 'u1', admin_access: admin } as never;
		},
	});

	await vi.waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
	await flushPromises();
	return mounted;
}

const tree = () => document.querySelector<HTMLElement>('[role="tree"]')!;
const keys = () => [...tree().querySelectorAll('[role="treeitem"]')].map((row) => row.getAttribute('data-key'));

test('four status links in order; the current one is the page', async () => {
	await setup({}, { path: '/users/invited' });

	const links = [...document.querySelectorAll('nav > ul:first-of-type a')];
	expect(links.map((a) => a.getAttribute('href'))).toEqual(['/users', '/users/suspended', '/users/invited', '/users/all']);
	const label = (a: Element) => [...a.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.textContent!.trim()).join('');
	expect(links.map(label)).toEqual([
		t('active_users'),
		t('suspended_users'),
		t('invited_users'),
		t('all_users'),
	]);
	expect(document.querySelector('a[aria-current="page"]')!.getAttribute('href')).toBe('/users/invited');
});

test('role tree: top roles, a role with children opens, the current role and its parents are open and selected', async () => {
	await setup({ currentRole: 'c' });

	expect(document.querySelector('[role="separator"]')).not.toBeNull();
	expect(keys()).toEqual(['a', 'b', 'c']);
	expect(tree().querySelector('[data-key="b"]')!.getAttribute('aria-expanded')).toBe('true');
	expect(tree().querySelector('[data-key="c"]')!.getAttribute('aria-level')).toBe('2');
	expect(tree().querySelector('[data-key="c"]')!.getAttribute('aria-selected')).toBe('true');
	expect(tree().querySelector('[data-key="c"] a')!.getAttribute('href')).toBe('/users/roles/c');

	// Collapse by the toggle button, then the keyboard: ArrowRight opens again.
	document.querySelector<HTMLButtonElement>(`button[aria-label="${t('collapse')} Editors"]`)!.click();
	await flushPromises();
	expect(keys()).toEqual(['a', 'b']);

	const editors = tree().querySelector<HTMLElement>('[data-key="b"] [data-tree-row]')!;
	editors.focus();
	await press(editors, 'ArrowRight');
	expect(keys()).toEqual(['a', 'b', 'c']);
});

test('no role: no divider and no tree', async () => {
	await setup({}, { roles: [] });
	expect(document.querySelector('[role="separator"]')).toBeNull();
	expect(document.querySelector('[role="tree"]')).toBeNull();
});

test('admin: a row menu with "edit role" to /settings/roles/:id; not for other users', async () => {
	const { wrapper } = await setup();
	const options = document.querySelector<HTMLButtonElement>(
		`button[aria-label="${t('item_options', { item: 'Editors' })}"]`,
	)!;
	expect(options).not.toBeNull();
	await press(options, 'Enter');
	await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull());
	expect(document.querySelector('[role="menuitem"]')!.getAttribute('href')).toBe('/settings/roles/b');

	wrapper.unmount();
	resetNavigationForTests();
	await setup({}, { admin: false });
	expect(document.querySelector(`button[aria-label="${t('item_options', { item: 'Editors' })}"]`)).toBeNull();
});
