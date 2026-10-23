// DR has no test for the roles routes (spec 016 T072, US4-1 to US4-3, FR-052, FR-053): the list request with
// `deep`, the Public row, the client search, the create dialog (`POST /roles {name}`), the role page (`PATCH` with the
// nested `{create, update, delete}`, invite with the role, delete, the `UNPROCESSABLE_CONTENT` error dialog) and the
// Public page (`GET /access`, then the three `/access` writes). The directus_roles fields are given to the fields
// store here (the fixture set has none); the form edits are emitted by BoForm as its interfaces do.
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoForm from '../../../../components/form/BoForm.vue';
import { resetNotices, useNotices } from '../../../../composables/use-notices.ts';
import { i18n } from '../../../../lang/index.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import UsersInvite from '../../../users/components/UsersInvite.vue';
import NewRole from './NewRole.vue';
import RoleItemRoute from './RoleItemRoute.vue';
import RolePublicRoute from './RolePublicRoute.vue';
import RolesCollectionRoute from './RolesCollectionRoute.vue';

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);
// Each test hydrates the fixture set and mounts BoForm: a loaded CI runner needs more than the 5 s default.
const SLOW = 15_000;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{
		path: '/settings/roles',
		name: 'settings-roles-collection',
		component: RolesCollectionRoute,
		children: [{ path: '+', name: 'settings-add-new-role', components: { add: NewRole } }],
	},
	{ path: '/settings/roles/public', name: 'settings-roles-public-item', component: RolePublicRoute },
	{ path: '/settings/roles/:primaryKey', name: 'settings-roles-item', component: RoleItemRoute, props: true },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const roleField = (field: string, meta: Record<string, unknown>, type = 'string') =>
	({
		collection: 'directus_roles',
		field,
		name: field,
		type,
		schema: type === 'alias' ? null : { is_primary_key: field === 'id' },
		meta: {
			collection: 'directus_roles',
			field,
			hidden: false,
			readonly: false,
			width: 'full',
			options: null,
			...meta,
		},
	}) as unknown as Field;

const ROLE_FIELDS = [
	roleField('id', { hidden: true }, 'uuid'),
	roleField('name', { interface: 'input', required: true, sort: 1 }),
	roleField(
		'policies',
		{ interface: 'list-m2m', hidden: true, special: ['m2m'], options: { layout: 'list' } },
		'alias',
	),
];

async function setup(path: string, answers: Record<string, unknown> = {}, disableDefault = false) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path,
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { user: 'admin', answers });
				await useUserStore().hydrate();
				await Promise.all([
					useFieldsStore().hydrate(),
					useRelationsStore().hydrate(),
					useCollectionsStore().hydrate(),
					usePermissionsStore().hydrate(),
				]);
				useFieldsStore().fields.push(...ROLE_FIELDS);
				useServerStore().info.queryLimit = { default: 100, max: -1 };
				useServerStore().auth.disableDefault = disableDefault;
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const button = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('button, a')].find((el) => el.getAttribute('aria-label') === label);
const dialogButton = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(b) => b.textContent?.trim() === label,
	)!;
const bodyOf = (method: string, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));
const rows = () =>
	[...document.querySelectorAll('main tbody tr')].map((r) => r.textContent?.replace(/\s+/g, ' ').trim());

const ROLES = [
	{
		id: 'r-editor',
		name: 'Editor',
		description: 'Edits content',
		icon: 'edit',
		users: [{ count: { id: 3 } }],
		children: [{ id: 'r-sub', name: 'Sub' }],
	},
	{ id: 'r-viewer', name: 'Viewer', description: 'Reads only', icon: 'visibility', users: [], children: [] },
];

describe('RolesCollectionRoute', () => {
	test(
		'GET /roles with the users count `deep`; Public first; counts; rows open the Public and role pages',
		async () => {
			const { router } = await setup('/settings/roles', { 'GET /roles': ROLES });
			expect(calls(fetch)).toContain(
				'GET /roles?fields=id,name,description,icon,users,children.name,children.id&sort=name&limit=-1&deep={"users":{"_aggregate":{"count":"id"},"_groupBy":["role"],"_sort":"role","_limit":-1}}',
			);
			expect(document.querySelector('main h1')!.textContent).toContain(t('settings_roles'));
			const list = rows();
			expect(list).toHaveLength(3);
			expect(list[0]).toContain(t('public_label'));
			expect(list[0]).toContain(t('public_description'));
			expect(list[1]).toContain('Editor');
			expect(list[1]).toContain('3');
			expect(list[2]).toContain('Viewer');
			// 0 users shows the null value like the DR v-table cell.
			expect(list[2]).toContain(t('no_value'));
			expect(button(t('create_role'))!.getAttribute('href')).toBe('/settings/roles/+');

			document.querySelectorAll<HTMLElement>('main tbody tr')[0]!.click();
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('settings-roles-public-item');

			await router.push('/settings/roles');
			await flushPromises();
			document.querySelectorAll<HTMLElement>('main tbody tr')[2]!.click();
			await flushPromises();
			expect(router.currentRoute.value.fullPath).toBe('/settings/roles/r-viewer');
		},
		SLOW,
	);

	test(
		'search filters on the client by name or description; no match shows clear filters',
		async () => {
			await setup('/settings/roles', { 'GET /roles': ROLES });
			const before = calls(fetch).length;
			const input = document.querySelector<HTMLInputElement>('main input[type="search"], header input')!;

			input.value = 'reads';
			input.dispatchEvent(new Event('input'));
			await flushPromises();
			await new Promise((resolve) => setTimeout(resolve, 600));
			await flushPromises();
			expect(rows()).toHaveLength(1);
			expect(rows()[0]).toContain('Viewer');
			expect(document.querySelector('main mark')!.textContent).toBe('Reads');

			input.value = 'nothing-matches';
			input.dispatchEvent(new Event('input'));
			await new Promise((resolve) => setTimeout(resolve, 600));
			await flushPromises();
			expect(document.body.textContent).toContain(t('no_results'));
			[...document.querySelectorAll<HTMLButtonElement>('main button')]
				.find((b) => b.textContent?.trim() === t('clear_filters'))!
				.click();
			await flushPromises();
			expect(rows()).toHaveLength(3);
			expect(
				calls(fetch)
					.slice(before)
					.filter((c) => c.startsWith('GET /roles')),
			).toEqual([]);
		},
		SLOW,
	);

	test(
		'the create dialog: Save disabled while empty, then POST /roles {name} and the new role page',
		async () => {
			const { router } = await setup('/settings/roles/+', {
				'GET /roles': ROLES,
				'POST /roles': { id: 'r-new', name: 'Writer' },
				'GET /roles/r-new': { id: 'r-new', name: 'Writer' },
			});

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('create_role'));
			expect(dialogButton(t('save')).disabled).toBe(true);
			expect([...dialog.querySelectorAll('button')].map((b) => b.textContent?.trim()).slice(-2)).toEqual([
				t('cancel'),
				t('save'),
			]);

			const input = dialog.querySelector<HTMLInputElement>('input')!;
			expect(input.maxLength).toBe(100);
			input.value = 'Writer';
			input.dispatchEvent(new Event('input'));
			await flushPromises();
			dialog.querySelector('form')!.requestSubmit();
			await flushPromises();
			await flushPromises();

			expect(bodyOf('POST', '/roles')).toEqual([{ name: 'Writer' }]);
			expect(router.currentRoute.value.fullPath).toBe('/settings/roles/r-new');
		},
		SLOW,
	);
});

describe('RoleItemRoute', () => {
	const role = { id: 'r-editor', name: 'Editor', icon: 'edit', description: null, policies: ['a-1'] };

	const answers = (
		patch: unknown = (args: { init: RequestInit }) =>
			json({ data: { ...role, ...JSON.parse(String(args.init.body)) } }),
	) => ({
		'GET /roles/r-editor': role,
		'PATCH /roles/r-editor': patch,
		'DELETE /roles/r-editor': () => new Response(null, { status: 204 }),
		'GET /roles': ROLES,
	});

	test(
		'GET /roles/:id with deep users _limit 0; the title; save sends the nested edits as one PATCH, then the user store',
		async () => {
			const { router, wrapper } = await setup('/settings/roles/r-editor', answers());

			expect(calls(fetch)).toContain('GET /roles/r-editor?deep={"users":{"_limit":0}}');
			expect(document.querySelector('main h1')!.textContent).toContain(t('editing_role', { role: 'Editor' }));
			expect(button(t('save'))!.disabled).toBe(true);

			const policies = { create: [{ policy: { id: 'p-new' } }], update: [], delete: ['a-1'] };
			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { policies });
			await flushPromises();
			const before = calls(fetch).length;
			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(bodyOf('PATCH', '/roles/r-editor')).toEqual([{ policies }]);
			const after = calls(fetch).slice(before);
			expect(after.findIndex((c) => c.startsWith('PATCH /roles/r-editor'))).toBeLessThan(
				after.findIndex((c) => c.startsWith('GET /users/me')),
			);
			expect(router.currentRoute.value.name).toBe('settings-roles-collection');
		},
		SLOW,
	);

	test(
		'UNPROCESSABLE_CONTENT on save: the error dialog, the page and the edits stay',
		async () => {
			const { router, wrapper } = await setup(
				'/settings/roles/r-editor',
				answers(() =>
					json({ errors: [{ message: 'At least one admin', extensions: { code: 'UNPROCESSABLE_CONTENT' } }] }, 422),
				),
			);

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { name: 'Renamed' });
			await flushPromises();
			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(useNotices().dialogs.value.map((d) => d.code)).toEqual(['UNPROCESSABLE_CONTENT']);
			expect(router.currentRoute.value.fullPath).toBe('/settings/roles/r-editor');
			expect(button(t('save'))!.disabled).toBe(false);
		},
		SLOW,
	);

	test(
		'invite opens UsersInvite with the role; hidden when the default login is off',
		async () => {
			const { wrapper } = await setup('/settings/roles/r-editor', answers());

			expect(wrapper.findComponent(UsersInvite).props()).toMatchObject({ modelValue: false, role: 'r-editor' });
			button(t('invite_users'))!.click();
			await flushPromises();
			expect(wrapper.findComponent(UsersInvite).props('modelValue')).toBe(true);

			wrapper.unmount();

			// The default login turned off before the page opens (set in the store before mount: deterministic on a
			// loaded CI runner, where switching it while the invite dialog was open did not re-render in time).
			await setup('/settings/roles/r-editor', answers(), true);
			expect(button(t('invite_users'))).toBeUndefined();
		},
		SLOW,
	);

	test(
		'delete: the confirm dialog, DELETE /roles/:id, the notice, back to the list',
		async () => {
			const { router } = await setup('/settings/roles/r-editor', answers());

			button(t('delete_label'))!.click();
			await flushPromises();
			expect(document.querySelector('[role="dialog"]')!.textContent).toContain(t('delete_are_you_sure'));
			dialogButton(t('delete_label')).click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain('DELETE /roles/r-editor');
			expect(useNotices().queue.value.map((n) => n.title)).toContain(t('item_delete_success', 1));
			expect(router.currentRoute.value.name).toBe('settings-roles-collection');
		},
		SLOW,
	);
});

describe('RolePublicRoute', () => {
	test(
		'GET /access of the public role; the notice and policies fields; save sends POST, PATCH and DELETE /access',
		async () => {
			const { router, wrapper } = await setup('/settings/roles/public', {
				'GET /access': [{ id: 'a-1' }, { id: 'a-2' }],
				'POST /access': [],
				'PATCH /access': [],
				'DELETE /access': () => new Response(null, { status: 204 }),
				'GET /roles': ROLES,
			});

			const access = '_and":[{"role":{"_null":true}},{"user":{"_null":true}}]';
			expect(calls(fetch)).toContain(`GET /access?fields=id&filter={"${access}}&limit=-1`);
			expect(document.querySelector('main h1')!.textContent).toContain(t('public_label'));
			expect(button(t('delete_label'))).toBeUndefined();
			expect(button(t('invite_users'))).toBeUndefined();

			const form = wrapper.findComponent(BoForm);
			const fields = form.props('fields') as Field[];
			expect(fields.map((f) => f.field)).toEqual(['notice', 'policies']);
			expect(fields[0]!.meta!.options).toEqual({ text: t('public_role_info') });
			expect(fields[1]!.meta!.options).toMatchObject({
				layout: 'list',
				junctionFilter: { role: { _null: true }, user: { _null: true } },
				filter: {
					'$FOLLOW(directus_access,policy)': {
						_none: { _and: [{ role: { _null: true } }, { user: { _null: true } }] },
					},
				},
			});
			// The store field is not changed (cloneDeep).
			expect(useFieldsStore().getField('directus_roles', 'policies')!.meta!.options).toEqual({ layout: 'list' });

			form.vm.$emit('update:modelValue', {
				policies: { create: [{ policy: 'p-3' }], update: [{ id: 'a-1', policy: 'p-1' }], delete: ['a-2'] },
			});
			await flushPromises();
			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(bodyOf('POST', '/access')).toEqual([[{ policy: 'p-3' }]]);
			expect(bodyOf('PATCH', '/access')).toEqual([[{ id: 'a-1', policy: 'p-1' }]]);
			expect(bodyOf('DELETE', '/access')).toEqual([['a-2']]);
			expect(calls(fetch).filter((c) => c.startsWith('GET /access'))).toHaveLength(2);
			expect(router.currentRoute.value.name).toBe('settings-roles-collection');
		},
		SLOW,
	);
});
