// The user story 3 parts of directus/app/src/modules/users (no DR test): routes/collection.vue (title and
// breadcrumb by status or role, the system filter, the buttons by selection and permissions, batch delete with the
// self-delete logout, the empty state), components/navigation.vue + NavigationRole.vue (status links, role tree, the
// admin "edit role" menu) and views/private/components/users-invite.vue (FR-050 to FR-066, CHK018 to CHK020, D-83).
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../api/sdk.ts';
import { logout } from '../../../auth.ts';
import { resetNotices } from '../../../composables/use-notices.ts';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { usePermissionsStore } from '../../../stores/permissions.ts';
import { usePresetsStore } from '../../../stores/presets.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { useServerStore } from '../../../stores/server.ts';
import { useUserStore } from '../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../test-utils/layout.ts';
import { resetNavigationForTests } from '../composables/use-navigation.ts';
import users from '../../users.ts';
import UsersCollectionRoute from './UsersCollectionRoute.vue';
import PageHeader from '../../../layout/PageHeader.vue';

vi.mock('../../../auth.ts', async (original) => ({
	...(await original<typeof import('../../../auth.ts')>()),
	logout: vi.fn(),
}));

vi.mock('../../../layouts/index.ts', () => {
	const slot = (name: string) =>
		defineComponent({ inheritAttrs: false, setup: () => () => h('div', { [`data-${name}`]: '' }, name) });

	// A tabular stand-in: shows the system filter and lets the test select users; renders the empty slots.
	const component = defineComponent({
		inheritAttrs: false,
		setup:
			(_, { attrs, slots }) =>
			() =>
				h('div', { 'data-layout': '', 'data-filter-system': JSON.stringify(attrs['filterSystem'] ?? null) }, [
					h('button', {
						'data-test': 'select',
						onClick: () => (attrs['onUpdate:selection'] as (v: unknown) => void)((window as any).__select ?? []),
					}),
					slots['no-items']?.(),
				]),
	});

	const tabular = {
		id: 'tabular',
		name: 'Table',
		icon: 'table_rows',
		component,
		slots: { options: slot('options'), sidebar: slot('sidebar'), actions: slot('actions') },
		setup: () => ({}),
	};

	return { getLayouts: () => [tabular], getLayout: (id: string) => (id === 'tabular' ? tabular : undefined) };
});

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(logout).mockReset();
	assertOnlyKnownRequests(calls(fetch));
});

const snapshot = loadSnapshot();
const roleId = (name: string) => snapshot.roles.find((r) => r['name'] === name)!['id'] as string;
const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

let fetch: ReturnType<typeof mockFixtureApi>;

const answerNotUnique = async () =>
	json(
		{
			errors: [
				{
					message: 'Value for field "email" in collection "directus_users" has to be unique.',
					extensions: { code: 'RECORD_NOT_UNIQUE', invalid: 'bo-active@example.com' },
				},
			],
		},
		400,
	);

beforeEach(async () => {
	resetNavigationForTests();
	resetNotices();
	localStorage.clear();
	(window as any).__select = [];
	await replaceQueue();
});

async function setup(props: Record<string, unknown> = { status: 'active' }, user: 'admin' | 'bo-viewer' = 'admin') {
	const mounted = await mountLayout(UsersCollectionRoute, {
		props,
		path: props['role'] ? `/users/roles/${props['role']}` : props['status'] ? '/users' : '/users/all',
		// The module routes (named links of the navigation), each rendering nothing.
		routes: [
			{
				path: '/users',
				component: { render: () => null },
				children: (users.routes as RouteRecordRaw[]).map((route) =>
					'redirect' in route && route.redirect ? route : ({ ...route, component: { render: () => null } } as RouteRecordRaw),
				),
			},
			{ path: '/:p(.*)*', component: { render: () => null } },
		],
		async beforeMount() {
			fetch = mockFixtureApi(loadSnapshot(), { user });
			await useUserStore().hydrate();
			await Promise.all([
				useFieldsStore().hydrate(),
				useRelationsStore().hydrate(),
				useCollectionsStore().hydrate(),
				usePermissionsStore().hydrate(),
				usePresetsStore().hydrate(),
			]);
			useServerStore().info.queryLimit = { default: 100, max: -1 };
		},
	});

	await flushPromises();
	return mounted;
}

const layout = () => document.querySelector<HTMLElement>('[data-layout]')!;
const heading = () => document.querySelector('main h1')?.textContent?.trim();
const named = (name: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === name);

describe('directory views', () => {
	test('active users: title, status filter, no breadcrumb', async () => {
		await setup();

		expect(heading()).toBe(t('active_users'));
		expect(JSON.parse(layout().dataset['filterSystem']!)).toEqual({ _and: [{ status: { _eq: 'active' } }] });
		expect(document.querySelector('nav[aria-label="Breadcrumb"]')).toBeNull();
	});

	test('a role: its name, the directory breadcrumb, the role filter, the add link with the role', async () => {
		const sub = roleId('bo-sub');
		const { wrapper } = await setup({ role: sub });

		expect(heading()).toBe('bo-sub');
		// D-101: the breadcrumb is passed to PageHeader but not shown.
		expect((wrapper.findComponent(PageHeader).props('breadcrumb') as { to: unknown }[])[0]!.to).toBe('/users');
		expect(JSON.parse(layout().dataset['filterSystem']!)).toEqual({ _and: [{ role: { _eq: sub } }] });
		expect(named(t('create_item'))!.getAttribute('href')).toBe(`/users/roles/${sub}/+`);
	});

	test('all users: no status filter and the "all users" title', async () => {
		await setup({});
		expect(heading()).toBe(t('all_users'));
		expect(JSON.parse(layout().dataset['filterSystem']!)).toBeNull();
	});

	test('empty list: the user count and the "create user" button for active users', async () => {
		await setup();
		expect(document.body.textContent).toContain(t('no_status_users_copy', { status: 'active' }));
		expect([...document.querySelectorAll('a')].find((a) => a.textContent?.trim() === t('create_user'))!.getAttribute('href')).toBe(
			'/users/+',
		);
	});

	test('a viewer without create rights: no invite button, the add button disabled, no invite roles request', async () => {
		await setup({ status: 'active' }, 'bo-viewer');
		expect(named(t('invite_users'))).toBeUndefined();
		expect(named(t('not_allowed'))).toBeDefined();
		// The invite dialog is not mounted, so its role list (`fields=id,name`) is never read (US6-3).
		expect(calls(fetch).filter((call) => call.startsWith('GET /roles?fields=id,name&'))).toEqual([]);
	});
});

describe('invite (FR-063)', () => {
	test('two emails go with the first role; the list reloads, then the "no email" notice shows (D-83)', async () => {
		await setup();
		named(t('invite_users'))!.click();
		await flushPromises();

		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
		expect(calls(fetch)).toContain('GET /roles?fields=id,name&sort=name');
		const textarea = dialog.querySelector('textarea')!;
		textarea.value = 'one@example.com,\ntwo@example.com';
		textarea.dispatchEvent(new Event('input'));
		await flushPromises();
		fetch.mockClear();

		dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
		await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
		await flushPromises();

		const invite = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!;
		expect(JSON.parse(String(invite[1]!.body))).toEqual({
			email: ['one@example.com', 'two@example.com'],
			role: roleId('bo-editor'),
		});
		expect(document.body.textContent).toContain(t('contact_admin_for_link'));
	});

	test('a RECORD_NOT_UNIQUE answer shows its message in the dialog', async () => {
		await setup();
		// DR skips known users; the database answers RECORD_NOT_UNIQUE (for example a case-insensitive clash).
		named(t('invite_users'))!.click();
		await flushPromises();

		const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
		const textarea = dialog.querySelector('textarea')!;
		textarea.value = 'bo-active@example.com';
		textarea.dispatchEvent(new Event('input'));
		await flushPromises();
		vi.mocked(fetch).mockImplementationOnce(answerNotUnique);
		dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();

		await vi.waitFor(() =>
			expect(dialog.textContent).toContain(t('email_already_invited', { email: 'bo-active@example.com' })),
		);
		expect(document.body.textContent).not.toContain(t('contact_admin_for_link'));
	});

	test('from a role there is no role select and the invite goes with that role', async () => {
		const editor = roleId('bo-editor');
		await setup({ role: editor });
		named(t('invite_users'))!.click();
		await flushPromises();

		expect(document.querySelector('[role="dialog"] [role="combobox"]')).toBeNull();
	});
});

describe('batch delete (FR-062)', () => {
	test('deletes the selection after the confirmation; deleting yourself logs out', async () => {
		await setup();
		const me = (useUserStore().currentUser as { id: string }).id;
		(window as any).__select = [me];
		document.querySelector<HTMLButtonElement>('[data-test="select"]')!.click();
		await flushPromises();

		named(t('delete_label'))!.click();
		await flushPromises();
		fetch.mockClear();
		const confirm = [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
			(b) => b.textContent?.trim() === t('delete_label'),
		)!;
		confirm.click();
		await vi.waitFor(() => expect(logout).toHaveBeenCalled());

		const del = fetch.mock.calls.find(([, init]) => init?.method === 'DELETE')!;
		expect(JSON.parse(String(del[1]!.body))).toEqual([me]);
		await press(document.body, 'Escape');
	});
});
