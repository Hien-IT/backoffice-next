// Directus has no test for the policies routes beyond use-duplicate (spec 016 T073, US4-4, US4-5, FR-055): the list
// request with the two counting `deep`, the duplicate dialog and its three requests, the create dialog with the app
// minimal permissions (`system: true` on each row), the policy page (one `PATCH` with the nested `permissions`), the
// edits guard with Keep Editing first and the Ctrl/Cmd+S and Ctrl/Cmd+Shift+S shortcuts. The directus_policies fields
// are given to the fields store here (the fixture set has none); `permissions` is hidden so the matrix does not load,
// and the form edits are emitted by BoForm as its interfaces do.
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoForm from '../../../../components/form/BoForm.vue';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { i18n } from '../../../../lang/index.ts';
import appPermissions from '../../../../permissions/app-permissions-data.json';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useServerStore } from '../../../../stores/server.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout, press } from '../../../../test-utils/layout.ts';
import NewPolicy from './NewPolicy.vue';
import PoliciesCollectionRoute from './PoliciesCollectionRoute.vue';
import PolicyItemRoute from './PolicyItemRoute.vue';

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
		path: '/settings/policies',
		name: 'settings-policies-collection',
		component: PoliciesCollectionRoute,
		children: [{ path: '+', name: 'settings-add-new-policy', components: { add: NewPolicy } }],
	},
	{ path: '/settings/policies/:primaryKey', name: 'settings-policies-item', component: PolicyItemRoute, props: true },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const policyField = (field: string, meta: Record<string, unknown>, type = 'string') =>
	({
		collection: 'directus_policies',
		field,
		name: field,
		type,
		schema: type === 'alias' ? null : { is_primary_key: field === 'id' },
		meta: {
			collection: 'directus_policies',
			field,
			hidden: false,
			readonly: false,
			width: 'full',
			options: null,
			...meta,
		},
	}) as unknown as Field;

const POLICY_FIELDS = [
	policyField('id', { hidden: true }, 'uuid'),
	policyField('name', { interface: 'input', required: true, sort: 1 }),
	policyField('permissions', { interface: 'system-permissions', hidden: true, special: ['o2m'] }, 'alias'),
];

async function setup(path: string, answers: Record<string, unknown> = {}) {
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
				useFieldsStore().fields.push(...POLICY_FIELDS);
				useServerStore().info.queryLimit = { default: 100, max: -1 };
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
/** The text of each cell after the icon column (name, users, roles, description). */
const rows = () =>
	[...document.querySelectorAll('main tbody tr')].map((r) =>
		[...r.querySelectorAll('td')].slice(1, 5).map((td) => td.textContent?.trim()),
	);

async function shortcut(...keys: string[]) {
	// The pressed keys are module state of use-shortcut: a keyup clears what earlier tests left.
	document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
	for (const key of keys) document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
	document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
	await flushPromises();
	await flushPromises();
}

const POLICIES = [
	{
		id: 'p-viewer',
		name: 'viewer',
		icon: 'visibility',
		description: 'Reads',
		enforce_tfa: false,
		ip_access: null,
		app_access: true,
		admin_access: false,
		users: [{ count: { user: 2 } }],
		roles: [{ count: { role: 1 } }],
	},
	{
		id: 'p-editor',
		name: 'Editor',
		icon: 'edit',
		description: 'Edits',
		enforce_tfa: true,
		ip_access: ['10.0.0.1'],
		app_access: true,
		admin_access: false,
		users: [],
		roles: [],
	},
];

describe('PoliciesCollectionRoute', () => {
	test(
		'GET /policies with the users and roles counts; sorted with localeCompare; a row opens its page',
		async () => {
			const { router } = await setup('/settings/policies', { 'GET /policies': POLICIES });

			const count = (by: string) =>
				`{"_aggregate":{"count":"${by}"},"_groupBy":["policy"],"_sort":"policy","_limit":-1}`;
			expect(calls(fetch)).toContain(
				`GET /policies?fields=id,name,icon,description,enforce_tfa,ip_access,app_access,admin_access,users,roles&sort=name&limit=-1&deep={"users":${count('user')},"roles":${count('role')}}`,
			);
			expect(document.querySelector('main h1')!.textContent).toContain(t('settings_permissions'));
			expect(rows()).toEqual([
				['Editor', '0', '0', 'Edits'],
				['viewer', '2', '1', 'Reads'],
			]);
			expect(button(t('create_policy'))!.getAttribute('href')).toBe('/settings/policies/+');

			document.querySelectorAll<HTMLElement>('main tbody tr')[1]!.click();
			await flushPromises();
			expect(router.currentRoute.value.fullPath).toBe('/settings/policies/p-viewer');
		},
		SLOW,
	);

	test(
		'duplicate: the name "<name> (copy)", GET /permissions, POST /policies, POST /permissions, reload, stay',
		async () => {
			const permission = {
				collection: 'articles',
				action: 'read',
				permissions: null,
				validation: null,
				presets: null,
				fields: ['*'],
				policy: 'p-editor',
			};
			const { router } = await setup('/settings/policies', {
				'GET /policies': POLICIES,
				'GET /permissions': [permission],
				'POST /policies': { id: 'p-copy' },
				'POST /permissions': [],
			});

			const trigger = button(t('item_options', { item: 'Editor' }))!;
			trigger.focus();
			await press(trigger, 'Enter');
			[...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
				.find((el) => el.textContent?.includes(t('duplicate_policy')))!
				.click();
			await flushPromises();

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('duplicate_policy'));
			expect(dialog.querySelector('input')!.value).toBe('Editor (copy)');
			const before = calls(fetch).length;
			dialog.querySelector('form')!.requestSubmit();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch).slice(before)).toEqual([
				'GET /permissions?fields=collection,action,permissions,validation,presets,fields,policy&filter={"policy":{"_eq":"p-editor"}}&limit=-1',
				'POST /policies',
				'POST /permissions',
				expect.stringMatching(/^GET \/policies\?/),
			]);
			expect(bodyOf('POST', '/policies')).toEqual([
				{
					name: 'Editor (copy)',
					icon: 'edit',
					description: 'Edits',
					enforce_tfa: true,
					ip_access: ['10.0.0.1'],
					app_access: true,
					admin_access: false,
				},
			]);
			expect(bodyOf('POST', '/permissions')).toEqual([[{ ...permission, policy: 'p-copy' }]]);
			expect(document.querySelector('[role="dialog"]')).toBeNull();
			expect(router.currentRoute.value.name).toBe('settings-policies-collection');
		},
		SLOW,
	);

	test.each([
		[true, false, true],
		[true, true, false],
		[false, false, false],
	])(
		'create with app_access %s and admin_access %s: POST /policies, minimal permissions %s, the new policy page',
		async (app, admin, minimal) => {
			const { router } = await setup('/settings/policies/+', {
				'GET /policies': POLICIES,
				'POST /policies': { id: 'p-new' },
				'POST /permissions': [],
				'GET /policies/p-new': { id: 'p-new', name: 'Writers' },
			});

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('create_policy'));
			expect(dialogButton(t('save')).disabled).toBe(true);
			const input = dialog.querySelector<HTMLInputElement>('input')!;
			input.value = 'Writers';
			input.dispatchEvent(new Event('input'));
			const [appBox, adminBox] = dialog.querySelectorAll<HTMLButtonElement>('button[role="checkbox"]');
			if (app) appBox!.click();
			if (admin) adminBox!.click();
			await flushPromises();
			dialog.querySelector('form')!.requestSubmit();
			await flushPromises();
			await flushPromises();

			expect(bodyOf('POST', '/policies')).toEqual([{ name: 'Writers', admin_access: admin, app_access: app }]);
			const posted = bodyOf('POST', '/permissions');
			if (minimal) {
				expect(posted).toEqual([appPermissions.minimal.map((row) => ({ ...row, policy: 'p-new' }))]);
				for (const row of posted[0]) expect(row).toMatchObject({ system: true, policy: 'p-new' });
			} else {
				expect(posted).toEqual([]);
			}
			expect(router.currentRoute.value.fullPath).toBe('/settings/policies/p-new');
		},
		SLOW,
	);
});

describe('PolicyItemRoute', () => {
	const policy = {
		id: 'p-editor',
		name: 'Editor',
		icon: 'edit',
		app_access: true,
		admin_access: false,
		permissions: [1, 2],
	};

	const answers = {
		'GET /policies/p-editor': policy,
		'PATCH /policies/p-editor': (args: { init: RequestInit }) =>
			json({ data: { ...policy, ...JSON.parse(String(args.init.body)) } }),
		'GET /policies': POLICIES,
	};

	const permissions = {
		create: [{ policy: 'p-editor', collection: 'articles', action: 'read', fields: ['*'] }],
		update: [{ id: 1, fields: ['title'] }],
		delete: [2],
	};

	test(
		'the title; save sends the nested permissions as one PATCH /policies/:id, no /permissions write, then the list',
		async () => {
			const { router, wrapper } = await setup('/settings/policies/p-editor', answers);

			expect(calls(fetch)).toContain('GET /policies/p-editor');
			expect(document.querySelector('main h1')!.textContent).toContain(t('editing_policy', { policy: 'Editor' }));
			expect(button(t('invite_users'))).toBeUndefined();

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { permissions });
			await flushPromises();
			button(t('save'))!.click();
			await flushPromises();
			await flushPromises();

			expect(bodyOf('PATCH', '/policies/p-editor')).toEqual([{ permissions }]);
			expect(calls(fetch).filter((c) => /^(POST|PATCH|DELETE) \/permissions/.test(c))).toEqual([]);
			expect(calls(fetch).filter((c) => c.startsWith('GET /users/me'))).toHaveLength(2);
			expect(router.currentRoute.value.name).toBe('settings-policies-collection');
		},
		SLOW,
	);

	test(
		'Ctrl/Cmd+S saves and stays; Ctrl/Cmd+Shift+S saves and opens the create dialog',
		async () => {
			const { router, wrapper } = await setup('/settings/policies/p-editor', answers);
			const form = () => wrapper.findComponent(BoForm);

			form().vm.$emit('update:modelValue', { name: 'Renamed' });
			await flushPromises();
			await shortcut('Control', 's');
			expect(bodyOf('PATCH', '/policies/p-editor')).toEqual([{ name: 'Renamed' }]);
			expect(router.currentRoute.value.fullPath).toBe('/settings/policies/p-editor');

			form().vm.$emit('update:modelValue', { name: 'Again' });
			await flushPromises();
			await shortcut('Control', 'Shift', 's');
			expect(bodyOf('PATCH', '/policies/p-editor').at(-1)).toEqual({ name: 'Again' });
			expect(router.currentRoute.value.name).toBe('settings-add-new-policy');
		},
		SLOW,
	);

	test(
		'leaving with edits asks first, Keep Editing first; discard leaves',
		async () => {
			const { router, wrapper } = await setup('/settings/policies/p-editor', answers);

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { name: 'Unsaved' });
			await flushPromises();
			await router.push('/settings/policies');
			await flushPromises();

			const dialog = document.querySelector('[role="dialog"]')!;
			expect(dialog.textContent).toContain(t('unsaved_changes'));
			const buttons = [...dialog.querySelectorAll('button')].map((b) => b.textContent!.trim());
			expect(buttons.slice(-2)).toEqual([t('keep_editing'), t('discard_changes')]);
			expect(router.currentRoute.value.name).toBe('settings-policies-item');

			dialogButton(t('discard_changes')).click();
			await flushPromises();
			expect(router.currentRoute.value.name).toBe('settings-policies-collection');
			expect(calls(fetch).filter((c) => c.startsWith('PATCH'))).toEqual([]);
		},
		SLOW,
	);

	test(
		'delete: the confirm dialog, DELETE /policies/:id, back to the list',
		async () => {
			const { router } = await setup('/settings/policies/p-editor', {
				...answers,
				'DELETE /policies/p-editor': () => new Response(null, { status: 204 }),
			});

			button(t('delete_label'))!.click();
			await flushPromises();
			dialogButton(t('delete_label')).click();
			await flushPromises();
			await flushPromises();

			expect(calls(fetch)).toContain('DELETE /policies/p-editor');
			expect(router.currentRoute.value.name).toBe('settings-policies-collection');
		},
		SLOW,
	);
});
