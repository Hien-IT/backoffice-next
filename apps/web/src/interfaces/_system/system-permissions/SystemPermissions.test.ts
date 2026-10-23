// Feature 016 (T070, US4-6, US4-7): the permissions matrix of the policy page, as DR system-permissions.vue:
// the level of each chip (none / all / custom), set all / none / remove row, the locked actions of directus_extensions,
// the app-minimal rows with app_access (an unsaved form value), admin_access hides the table, the two resets, adding a
// collection, the `{ create, update, delete }` value (or undefined without changes) and the reload after a save.
import type { Permission } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { ref } from 'vue';
import BoDialog from '../../../components/BoDialog.vue';
import BoMenu, { type BoMenuItem } from '../../../components/BoMenu.vue';
import BoNotice from '../../../components/BoNotice.vue';
import ValueNull from '../../../components/render/ValueNull.vue';
import { replaceQueue } from '../../../api/sdk.ts';
import { i18n } from '../../../lang/index.ts';
import { useCollectionsStore } from '../../../stores/collections.ts';
import { useFieldsStore } from '../../../stores/fields.ts';
import { useRelationsStore } from '../../../stores/relations.ts';
import { calls, mockApi } from '../../../test-utils/fetch.ts';
import AddCollection from './AddCollection.vue';
import { appAccessMinimalPermissions, appRecommendedPermissions } from './app-permissions.ts';
import PermissionsDetail from './detail/PermissionsDetail.vue';
import PermissionsRow from './PermissionsRow.vue';
import PermissionsToggle from './PermissionsToggle.vue';
import SystemPermissions from './SystemPermissions.vue';

enableAutoUnmount(afterEach);

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

const PERMISSIONS: Permission[] = [
	{
		id: 1,
		policy: 'p1',
		collection: 'bo_std',
		action: 'read',
		fields: ['*'],
		permissions: {},
		validation: null,
		presets: null,
	},
	{
		id: 2,
		policy: 'p1',
		collection: 'bo_std',
		action: 'create',
		fields: ['title'],
		permissions: null,
		validation: null,
		presets: null,
	},
	{
		id: 3,
		policy: 'p1',
		collection: 'directus_users',
		action: 'read',
		fields: ['*'],
		permissions: {},
		validation: null,
		presets: null,
	},
] as Permission[];

let pinia: ReturnType<typeof createPinia>;
let fetch: ReturnType<typeof mockApi>;

beforeEach(async () => {
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);

	const collections = useCollectionsStore();
	collections.collections = [
		'bo_std',
		'bo_other',
		'directus_users',
		'directus_extensions',
		'directus_collections',
		'directus_permissions',
		'directus_policies',
	].map((collection) =>
		collections.prepareCollectionForApp({ collection, schema: { name: collection }, meta: {} } as never),
	);

	useFieldsStore().fields = [
		{ collection: 'directus_policies', field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: null },
		{
			collection: 'directus_policies',
			field: 'permissions',
			type: 'alias',
			schema: null,
			meta: { special: ['o2m'], interface: 'system-permissions' },
		},
		{ collection: 'directus_permissions', field: 'id', type: 'integer', schema: { is_primary_key: true }, meta: null },
		{ collection: 'directus_permissions', field: 'policy', type: 'uuid', schema: {}, meta: null },
	] as never;

	useRelationsStore().relations = [
		{
			collection: 'directus_permissions',
			field: 'policy',
			related_collection: 'directus_policies',
			schema: null,
			meta: { one_field: 'permissions', junction_field: null, many_field: 'policy', sort_field: null },
		},
	] as never;

	fetch = mockApi({
		'GET /permissions': PERMISSIONS,
		'GET /policies/p1': { id: 'p1', name: 'Editors', app_access: false, admin_access: false },
	});
});

async function render(
	props: Record<string, unknown> = {},
	values: Record<string, unknown> = { app_access: false, admin_access: false },
) {
	const valuesRef = ref(values);
	// v-model of the form: the emitted value comes back as the `value` prop.
	const wrapper: ReturnType<typeof mount<typeof SystemPermissions>> = mount(SystemPermissions, {
		props: {
			primaryKey: 'p1',
			value: [1, 2, 3],
			collection: 'directus_policies',
			field: 'permissions',
			onInput: (value: unknown) => wrapper.setProps({ value: value as never }),
			...props,
		},
		global: { plugins: [pinia, i18n], provide: { values: valuesRef } },
		attachTo: document.body,
	});
	await flushPromises();
	return { wrapper, values: valuesRef };
}

const rows = (wrapper: Awaited<ReturnType<typeof render>>['wrapper']) =>
	wrapper.findAllComponents(PermissionsRow).map((row) => row.props('collection').collection);

const toggle = (wrapper: Awaited<ReturnType<typeof render>>['wrapper'], collection: string, action: string) =>
	wrapper
		.findAllComponents(PermissionsToggle)
		.find((item) => item.props('collection').collection === collection && item.props('action') === action)!;

const lastInput = (wrapper: Awaited<ReturnType<typeof render>>['wrapper']) => wrapper.emitted('input')!.at(-1)![0];

describe('loading and rows', () => {
	test('loads the permissions of the policy, regular collections first, then the system divider', async () => {
		const { wrapper } = await render();

		// The detail drawer loads the policy when it mounts, as DR (watch immediate), before it is opened.
		expect(calls(fetch)).toEqual([
			// DR sends `page: 0`; the SDK drops pages below 1 (query-to-params.ts). With limit -1 the rows are the same.
			'GET /permissions?fields=*&filter={"_and":[{"policy":"p1"}]}&limit=-1',
			'GET /policies/p1?deep={"users":{"_limit":0}}',
		]);
		expect(rows(wrapper)).toEqual(['bo_std', 'directus_users']);
		expect(wrapper.find('.system-divider').text()).toBe(t('system_collections'));
		expect(wrapper.find('table caption').text()).toBe(t('permissions'));
	});

	test('nothing is loaded for a new policy; the empty state shows', async () => {
		const { wrapper } = await render({ primaryKey: '+', value: [] });

		expect(calls(fetch)).toEqual([]);
		expect(wrapper.find('.empty-state').text()).toBe(t('no_permissions'));
	});

	test('admin_access (unsaved form value) shows only the notice', async () => {
		const { wrapper } = await render({}, { app_access: false, admin_access: true });

		expect(wrapper.findComponent(BoNotice).text()).toContain(t('admins_have_all_permissions'));
		expect(wrapper.find('table').exists()).toBe(false);
	});
});

describe('levels and actions', () => {
	test('none / all / custom as Directus permissionLevel; the level is the accessible name', async () => {
		const { wrapper } = await render();

		const level = (collection: string, action: string) =>
			toggle(wrapper, collection, action).find('button').attributes('aria-label');

		expect(level('bo_std', 'read')).toBe(t('permissionsLevel.all', { action: t('read') }));
		expect(level('bo_std', 'create')).toBe(t('permissionsLevel.custom', { action: t('create') }));
		expect(level('bo_std', 'delete')).toBe(t('permissionsLevel.none', { action: t('delete') }));
	});

	test('the menu: all_access disabled when all, no_access disabled when none, then use_custom', async () => {
		const { wrapper } = await render();

		const items = (action: string) =>
			toggle(wrapper, 'bo_std', action)
				.findComponent(BoMenu)
				.props('items')
				.map((item: BoMenuItem) => [item.text, !!item.disabled]);

		expect(items('read')).toEqual([
			[t('all_access'), true],
			[t('no_access'), false],
			[t('use_custom'), false],
		]);
		expect(items('delete')).toEqual([
			[t('all_access'), false],
			[t('no_access'), true],
			[t('use_custom'), false],
		]);
	});

	test('set all updates an existing permission and creates a missing one; set none deletes', async () => {
		const { wrapper } = await render();

		toggle(wrapper, 'bo_std', 'create').vm.$emit('setFullAccess');
		toggle(wrapper, 'bo_std', 'update').vm.$emit('setFullAccess');
		toggle(wrapper, 'directus_users', 'read').vm.$emit('setNoAccess');
		await flushPromises();

		expect(lastInput(wrapper)).toEqual({
			create: [
				{
					policy: 'p1',
					collection: 'bo_std',
					action: 'update',
					fields: ['*'],
					permissions: null,
					validation: null,
					presets: null,
				},
			],
			update: [{ ...PERMISSIONS[1], fields: ['*'], permissions: null, validation: null, presets: null }],
			delete: [3],
		});
	});

	test('the all / none shortcuts of a row; remove row deletes every action and drops the row', async () => {
		const { wrapper } = await render();

		wrapper.findAllComponents(PermissionsRow)[0]!.vm.$emit('setFullAccessAll');
		await flushPromises();
		expect((lastInput(wrapper) as any).create.map((p: Permission) => p.action)).toEqual(['update', 'delete', 'share']);

		wrapper.findAllComponents(PermissionsRow)[0]!.vm.$emit('removeRow');
		await flushPromises();
		// DR order: create (2, updated by the shortcut, then deleted) before read (1).
		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [2, 1] });
		expect(rows(wrapper)).toEqual(['directus_users']);
	});

	test('undoing every change emits undefined (no alteration)', async () => {
		const { wrapper } = await render();

		toggle(wrapper, 'bo_std', 'update').vm.$emit('setFullAccess');
		await flushPromises();
		toggle(wrapper, 'bo_std', 'update').vm.$emit('setNoAccess');
		await flushPromises();

		expect(lastInput(wrapper)).toBeUndefined();
	});

	test('directus_extensions: create and delete locked (ValueNull, no change)', async () => {
		const { wrapper } = await render();

		wrapper.findComponent(AddCollection).vm.$emit('select', 'directus_extensions');
		await flushPromises();

		const row = wrapper
			.findAllComponents(PermissionsRow)
			.find((r) => r.props('collection').collection === 'directus_extensions')!;
		expect(row.findAllComponents(PermissionsToggle).map((item) => item.props('action'))).toEqual([
			'read',
			'update',
			'share',
		]);
		expect(row.findAllComponents(ValueNull)).toHaveLength(2);

		row.vm.$emit('setFullAccessAll');
		await flushPromises();
		expect((lastInput(wrapper) as any).create.map((p: Permission) => p.action)).toEqual(['read', 'update', 'share']);
	});
});

describe('app access', () => {
	test('app_access (unsaved) adds the app-minimal rows with a locked chip and no "no access"', async () => {
		const { wrapper } = await render({}, { app_access: true, admin_access: false });

		expect(rows(wrapper)).toContain('directus_collections');

		const minimal = appAccessMinimalPermissions.find((p) => p.collection === 'directus_collections')!;
		const chip = toggle(wrapper, 'directus_collections', minimal.action!);
		expect(chip.find('[role="img"]').attributes('title')).toBe(t('required_for_app_access'));
		expect(chip.findComponent(BoMenu).exists()).toBe(false);

		const other = toggle(wrapper, 'directus_users', 'update');
		expect(
			other
				.findComponent(BoMenu)
				.props('items')
				.map((i: BoMenuItem) => i.text),
		).toEqual([t('all_access'), t('no_access'), t('use_custom')]);
		expect(wrapper.find('.reset-toggle').text()).toContain(t('reset_system_permissions_to'));
	});

	test('reset to the minimum deletes the system permissions; recommended also creates the recommended rows', async () => {
		const { wrapper } = await render({}, { app_access: true, admin_access: false });
		// The dialog is teleported to the body.
		const resetButton = () =>
			[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
				(b) => b.textContent?.trim() === t('reset'),
			)!;

		const [minimum] = wrapper.findAll('.reset-toggle button');

		await minimum!.trigger('click');
		expect(wrapper.findComponent(BoDialog).props('title')).toBe(t('reset_system_permissions_copy'));
		resetButton().click();
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({ create: [], update: [], delete: [3] });

		// A second reset on the same staged value would undo the staged deletes (DR removes the `deleted` items
		// too): the recommended reset starts from a fresh page.
		wrapper.unmount();
		const second = await render({}, { app_access: true, admin_access: false });
		await second.wrapper.findAll('.reset-toggle button')[1]!.trigger('click');
		await flushPromises();
		resetButton().click();
		await flushPromises();
		const value = lastInput(second.wrapper) as any;
		expect(value.delete).toEqual([3]);
		expect(value.create).toEqual(appRecommendedPermissions.map((perm) => ({ ...perm, policy: 'p1' })));
	});
});

describe('add collection, detail drawer, reload', () => {
	test('add collection: managed then system collections, the rows already in the table disabled', async () => {
		const { wrapper } = await render();

		const items = wrapper
			.findComponent(AddCollection)
			.findComponent(BoMenu)
			.props('items')
			.map((item: BoMenuItem) => [item.text, !!item.disabled, !!item.divider]);

		expect(items[0]).toEqual(['bo_other', false, false]);
		expect(items[1]).toEqual(['bo_std', true, true]);
		// D-118: system collections are labelled backoffice_*.
		expect(items.find((item: unknown[]) => item[0] === 'backoffice_users')).toEqual(['backoffice_users', true, false]);

		wrapper.findComponent(AddCollection).vm.$emit('select', 'bo_other');
		await flushPromises();
		expect(rows(wrapper)).toEqual(['bo_other', 'bo_std', 'directus_users']);
		expect(wrapper.emitted('input')).toBeUndefined();
	});

	test('use custom opens the drawer on the permission ("+" for a new one); its result is staged', async () => {
		const { wrapper } = await render();

		toggle(wrapper, 'bo_std', 'create').vm.$emit('edit');
		await flushPromises();
		expect(wrapper.findComponent(PermissionsDetail).props()).toMatchObject({ active: true, permissionKey: 2 });

		wrapper.findComponent(PermissionsDetail).vm.$emit('input', { ...PERMISSIONS[1], fields: ['title', 'body'] });
		wrapper.findComponent(PermissionsDetail).vm.$emit('update:active', false);
		await flushPromises();
		expect(lastInput(wrapper)).toEqual({
			create: [],
			update: [{ ...PERMISSIONS[1], fields: ['title', 'body'] }],
			delete: [],
		});

		toggle(wrapper, 'bo_std', 'share').vm.$emit('edit');
		await flushPromises();
		expect(wrapper.findComponent(PermissionsDetail).props()).toMatchObject({
			permissionKey: '+',
			edits: { policy: 'p1', collection: 'bo_std', action: 'share', fields: null, permissions: null },
		});

		wrapper.findComponent(PermissionsDetail).vm.$emit('input', null);
		await flushPromises();
		expect((lastInput(wrapper) as any).create).toEqual([]);
	});

	test('after "save and stay" (the value goes back to ids) the permissions are loaded again', async () => {
		const { wrapper } = await render();

		toggle(wrapper, 'bo_std', 'update').vm.$emit('setFullAccess');
		await flushPromises();
		await wrapper.setProps({ value: lastInput(wrapper) as never });
		await wrapper.setProps({ value: [1, 2, 3, 4] });
		await flushPromises();

		expect(calls(fetch).filter((call) => call.startsWith('GET /permissions'))).toHaveLength(2);
	});
});
