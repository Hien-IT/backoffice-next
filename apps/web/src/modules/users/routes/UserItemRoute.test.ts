// The user story 4 part of directus/app/src/modules/users/routes/item.vue (no DR test): the item query, the user
// box, the form without the sidebar fields, save of the edited fields only, a new user from a role, archive, delete
// (yourself logs out), the module not-found page (FR-070 to FR-076). The information panel has its own test
// (UserInfoSidebarDetail.test.ts).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { logout } from '../../../auth.ts';
import { resetNotices } from '../../../composables/use-notices.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../test-utils/layout.ts';
import { resetNavigationForTests } from '../composables/use-navigation.ts';
import UserItemRoute from './UserItemRoute.vue';

vi.mock('../../../auth.ts', async (original) => ({
	...(await original<typeof import('../../../auth.ts')>()),
	logout: vi.fn(),
}));

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(logout).mockReset();
	assertOnlyKnownRequests(calls(fetch));
});

const snapshot = loadSnapshot();
const userOf = (email: string) => snapshot.directoryUsers.find((u) => u['email'] === email)!;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNavigationForTests();
	resetNotices();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{ path: '/users/:primaryKey', name: 'users-item', component: { render: () => null } },
	{ path: '/users', name: 'users-active', component: { render: () => null } },
	{ path: '/users/roles/:role', name: 'roles-collection', component: { render: () => null } },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

async function setup(props: Record<string, unknown>) {
	const mounted = await mountLayout(UserItemRoute, {
		props,
		routes,
		path: `/users/${props['primaryKey']}`,
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), { user: 'admin' });
			await useUserStore().hydrate();
			await Promise.all([
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
				usePermissionsStore().hydrate(),
			]);
			useServerStore().info.queryLimit = { default: 100, max: -1 };
		},
	});

	await flushPromises();
	await flushPromises();
	return mounted;
}

const button = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === name);
const labels = () => [...document.querySelectorAll('main label')].map((l) => l.textContent?.trim());

function fill(label: string, value: string) {
	const element = [...document.querySelectorAll('label')].find((l) => l.textContent?.trim() === label)!;
	const input = document.getElementById(element.htmlFor) as HTMLInputElement;
	input.value = value;
	input.dispatchEvent(new Event('input'));
}

describe('UserItemRoute', () => {
	test('loads the user with its role and avatar, shows the user box and the form without the sidebar fields', async () => {
		const user = userOf('bo-suspended@example.com');
		await setup({ primaryKey: user['id'] });

		expect(calls(fetch)).toContain(`GET /users/${user['id']}?fields=*,role.*,avatar.id,avatar.modified_on`);
		const box = document.querySelector('.user-box')!;
		expect(box.querySelector('.name')!.textContent).toContain('Sam Suspended');
		expect(box.querySelector('.email')!.textContent).toContain('bo-suspended@example.com');
		const badge = box.querySelector('.role-badge')!;
		expect(badge.textContent).toContain('bo-editor');
		expect(badge.className).toContain('suspended');
		expect(badge.className).toContain('text-error-700');
		expect(document.querySelector('main h1')!.textContent).toContain('Sam Suspended');

		// fieldsDenyList: the sidebar fields stay out of the form; the email is in the box and the form (CHK102).
		expect(labels()).toContain('Email');
		expect(labels()).not.toContain('Last Page');
		expect(labels()).not.toContain('Last Access');
	});

	test('save sends only the edited fields and goes to the directory', async () => {
		const user = userOf('bo-draft@example.com');
		const { router } = await setup({ primaryKey: user['id'] });

		fill('Title', 'Engineer');
		await flushPromises();
		button('Save')!.click();
		await flushPromises();
		await flushPromises();

		const patch = fetch.mock.calls.find(([url, init]) => String(url).includes(`/users/${user['id']}`) && init?.method === 'PATCH')!;
		expect(JSON.parse(patch[1]!.body as string)).toEqual({ title: 'Engineer' });
		expect(router.currentRoute.value.fullPath).toBe('/users');
	});

	test('a new user from a role route starts with that role; no user box; title "Adding User"', async () => {
		const editor = snapshot.roles.find((r) => r['name'] === 'bo-editor')!['id'];
		await setup({ primaryKey: '+', role: editor });

		expect(document.querySelector('.user-box')).toBeNull();
		expect(document.querySelector('main h1')!.textContent).toContain('Adding User');

		fill('Email', 'new-user@example.com');
		await flushPromises();
		button('Save')!.click();
		await flushPromises();
		await flushPromises();

		const post = fetch.mock.calls.find(([url, init]) => String(url).endsWith('/users') && init?.method === 'POST')!;
		expect(JSON.parse(post[1]!.body as string)).toMatchObject({ role: editor, email: 'new-user@example.com' });
	});

	test('archive patches the status and goes to the directory', async () => {
		const user = userOf('bo-active@example.com');
		const { router } = await setup({ primaryKey: user['id'] });

		button('Archive')!.click();
		await flushPromises();
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.find((b) => b.textContent?.trim() === 'Archive')!
			.click();
		await flushPromises();
		await flushPromises();

		const patch = fetch.mock.calls.find(([url, init]) => String(url).includes(`/users/${user['id']}`) && init?.method === 'PATCH')!;
		expect(JSON.parse(patch[1]!.body as string)).toEqual({ status: 'archived' });
		expect(router.currentRoute.value.fullPath).toBe('/users');
	});

	test('delete another user goes back to the directory; deleting yourself logs out', async () => {
		const user = userOf('bo-token@example.com');
		const { router } = await setup({ primaryKey: user['id'] });

		button('Delete')!.click();
		await flushPromises();
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.find((b) => b.textContent?.trim() === 'Delete')!
			.click();
		await flushPromises();
		await flushPromises();

		expect(calls(fetch)).toContain(`DELETE /users/${user['id']}`);
		expect(router.currentRoute.value.fullPath).toBe('/users');
		expect(logout).not.toHaveBeenCalled();
	});

	test('deleting yourself logs out', async () => {
		await setup({ primaryKey: snapshot.users.admin.me['id'] as string });
		button('Delete')!.click();
		await flushPromises();
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.find((b) => b.textContent?.trim() === 'Delete')!
			.click();
		await vi.waitFor(() => expect(logout).toHaveBeenCalled());
	});

	test('a missing user shows the module not-found page', async () => {
		await setup({ primaryKey: 'not-there' });
		expect(document.body.textContent).toContain('Page Not Found');
	});
});
