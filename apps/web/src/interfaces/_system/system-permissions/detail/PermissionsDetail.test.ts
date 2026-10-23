// Feature 016 (T071, US4-8): the permission detail drawer, as DR permissions-detail.vue: the two loads (policy
// with `deep[users][_limit]=0`, then the permission) merged with the staged edits, the tabs by action with their dot,
// the title, the fields tab (`*` shows every field checked, a selection is an explicit list, none is `null`), the
// app-minimal values read-only and locked in the tree, the presets warning for relational arrays, and saving
// (`isPermissionEmpty` → null).
import type { Permission } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { replaceQueue } from '../../../../api/sdk.ts';
import BoCheckboxTree from '../../../../components/BoCheckboxTree.vue';
import BoTabs from '../../../../components/BoTabs.vue';
import { i18n } from '../../../../lang/index.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { calls, mockApi } from '../../../../test-utils/fetch.ts';
import { appAccessMinimalPermissions } from '../app-permissions.ts';
import AppMinimal from './AppMinimal.vue';
import FieldsTab from './FieldsTab.vue';
import PermissionsDetail from './PermissionsDetail.vue';
import PresetsTab from './PresetsTab.vue';

enableAutoUnmount(afterEach);

const t = (key: string, ...args: unknown[]) => (i18n.global.t as (...a: unknown[]) => string)(key, ...args);

const READ: Permission = {
	id: 2,
	policy: 'p1',
	collection: 'bo_std',
	action: 'read',
	fields: ['*'],
	permissions: { status: { _eq: 'published' } },
	validation: null,
	presets: null,
} as Permission;

const EMPTY = { policy: 'p1', permissions: null, validation: null, fields: null, presets: null };

let pinia: ReturnType<typeof createPinia>;
let fetch: ReturnType<typeof mockApi>;

beforeEach(async () => {
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);

	const collections = useCollectionsStore();
	collections.collections = ['bo_std', 'bo_comments', 'directus_users'].map((collection) =>
		collections.prepareCollectionForApp({ collection, schema: { name: collection }, meta: {} } as never),
	);

	useFieldsStore().fields = [
		{ collection: 'bo_std', field: 'id', name: 'ID', type: 'integer', schema: { is_primary_key: true }, meta: null },
		{ collection: 'bo_std', field: 'title', name: 'Title', type: 'string', schema: {}, meta: { sort: 1 } },
		{ collection: 'bo_std', field: 'status', name: 'Status', type: 'string', schema: {}, meta: { sort: 2 } },
		{
			collection: 'bo_std',
			field: 'comments',
			name: 'Comments',
			type: 'alias',
			schema: null,
			meta: { special: ['o2m'], sort: 3 },
		},
		{
			collection: 'directus_users',
			field: 'id',
			name: 'ID',
			type: 'uuid',
			schema: { is_primary_key: true },
			meta: null,
		},
		{ collection: 'directus_users', field: 'email', name: 'Email', type: 'string', schema: {}, meta: null },
	] as never;

	useRelationsStore().relations = [
		{
			collection: 'bo_comments',
			field: 'post',
			related_collection: 'bo_std',
			schema: null,
			meta: { one_field: 'comments', junction_field: null },
		},
	] as never;

	fetch = mockApi({
		'GET /policies/p1': { id: 'p1', name: 'Editors', app_access: false, admin_access: false },
		'GET /permissions/2': READ,
	});
});

async function render(props: Record<string, unknown> = {}) {
	const wrapper = mount(PermissionsDetail, {
		props: { active: true, policyKey: 'p1', permissionKey: 2, edits: {}, policyEdits: {}, ...props },
		global: { plugins: [pinia, i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

const tabs = (wrapper: Awaited<ReturnType<typeof render>>) =>
	(wrapper.findComponent(BoTabs).props('items') as unknown as { label: string; hasValue: boolean }[]).map((tab) => [
		tab.label,
		tab.hasValue,
	]);

const saveButton = () =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(button) => button.getAttribute('aria-label') === t('save'),
	)!;

describe('loading, title and tabs', () => {
	test('loads the policy then the permission, merges the staged edits; title policy -> collection -> action', async () => {
		const wrapper = await render({ edits: { fields: ['title'] } });

		expect(calls(fetch)).toEqual(['GET /policies/p1?deep={"users":{"_limit":0}}', 'GET /permissions/2']);
		expect(document.querySelector('[role="dialog"] h2, [role="dialog"] [id$="title"]')?.textContent ?? '').toContain(
			`Editors -> bo_std -> ${t('read')}`,
		);
		expect(tabs(wrapper)).toEqual([
			[t('item_permissions'), true],
			[t('field_permissions'), true],
		]);
	});

	test.each([
		['create', ['field_permissions', 'field_validation', 'field_presets']],
		['read', ['item_permissions', 'field_permissions']],
		['update', ['item_permissions', 'field_permissions', 'field_validation', 'field_presets']],
		['delete', ['item_permissions']],
		['share', ['item_permissions']],
	])('a new %s permission ("+") has the Directus tabs, without request for it', async (action, keys) => {
		const wrapper = await render({
			permissionKey: '+',
			edits: {
				policy: 'p1',
				collection: 'bo_std',
				action,
				fields: null,
				permissions: null,
				validation: null,
				presets: null,
			},
		});

		expect(calls(fetch)).toEqual(['GET /policies/p1?deep={"users":{"_limit":0}}']);
		expect(tabs(wrapper)).toEqual(keys.map((key) => [t(key), false]));
	});

	test('a new policy ("+") uses the unsaved form values as policy, without request', async () => {
		const wrapper = await render({
			policyKey: '+',
			permissionKey: '+',
			policyEdits: { name: 'Draft policy' },
			edits: { ...EMPTY, policy: '+', collection: 'bo_std', action: 'delete' },
		});

		expect(calls(fetch)).toEqual([]);
		expect(wrapper.text() + document.body.textContent).toContain('Draft policy -> bo_std');
	});
});

describe('fields tab', () => {
	async function fieldsTab(edits: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
		const wrapper = await render({
			permissionKey: '+',
			// The shape of SystemPermissions createEmptyPermission (every key present).
			edits: { ...EMPTY, collection: 'bo_std', action: 'create', ...edits },
			...props,
		});
		return wrapper.findComponent(FieldsTab);
	}

	test('`*` shows every field checked; a selection is an explicit list; none is null', async () => {
		const tab = await fieldsTab({ fields: ['*'] });
		const tree = tab.findComponent(BoCheckboxTree);

		expect([...(tree.props('modelValue') as string[])].sort()).toEqual(['comments', 'id', 'status', 'title']);

		tree.vm.$emit('update:modelValue', ['id', 'title', 'status', 'comments']);
		expect(tab.emitted('update:permission')!.at(-1)![0]).toMatchObject({
			fields: ['id', 'title', 'status', 'comments'],
		});

		tree.vm.$emit('update:modelValue', []);
		expect(tab.emitted('update:permission')!.at(-1)![0]).toMatchObject({ fields: null });
	});

	test('app minimal: values read-only under the warning and locked in the tree', async () => {
		fetch = mockApi({ 'GET /policies/p1': { id: 'p1', name: 'Editors', app_access: true, admin_access: false } });
		const minimal = appAccessMinimalPermissions.find((p) => p.collection === 'directus_users' && p.action === 'read')!;

		const wrapper = await render({
			permissionKey: '+',
			edits: { ...EMPTY, collection: 'directus_users', action: 'read' },
		});

		// The first tab is item permissions; open the fields tab.
		const fieldsTrigger = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
			tab.textContent?.includes(t('field_permissions')),
		)!;
		fieldsTrigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await flushPromises();

		const tab = wrapper.findComponent(FieldsTab);
		expect(tab.findComponent(AppMinimal).props('value')).toEqual(minimal.fields);
		expect(document.body.textContent).toContain(t('the_following_are_minimum_permissions'));

		const choices = tab.findComponent(BoCheckboxTree).props('choices') as { value: string; disabled: boolean }[];
		const locked = new Set(minimal.fields!.includes('*') ? choices.map((c) => c.value) : minimal.fields);
		expect(choices.every((choice) => choice.disabled === locked.has(choice.value))).toBe(true);
	});
});

describe('presets and saving', () => {
	test('a relational field preset as a non-empty array shows presets_field_warning', async () => {
		const wrapper = await render({
			permissionKey: '+',
			edits: { ...EMPTY, collection: 'bo_std', action: 'create', presets: { comments: [1] } },
		});

		const presetsTrigger = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
			tab.textContent?.includes(t('field_presets')),
		)!;
		presetsTrigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await flushPromises();

		expect(wrapper.findComponent(PresetsTab).text()).toContain(t('presets_field_warning', { field: 'comments' }));
	});

	test('save emits the permission; an empty one (isPermissionEmpty) emits null; the drawer closes', async () => {
		const wrapper = await render({ edits: { fields: ['title'] } });

		saveButton().click();
		await flushPromises();
		expect(wrapper.emitted('input')).toEqual([[{ ...READ, fields: ['title'] }]]);
		expect(wrapper.emitted('update:active')).toEqual([[false]]);

		const empty = await render({
			permissionKey: '+',
			edits: {
				policy: 'p1',
				collection: 'bo_std',
				action: 'delete',
				fields: null,
				permissions: {},
				validation: null,
				presets: null,
			},
		});
		[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
			.filter((button) => button.getAttribute('aria-label') === t('save'))
			.at(-1)!
			.click();
		await flushPromises();
		expect(empty.emitted('input')).toEqual([[null]]);
	});
});
