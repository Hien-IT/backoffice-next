// Directus has no test for the presets routes (spec 016 T101, US6-1 to US6-3, contracts/api-calls.md #151, #152,
// #175): the list on the 014 layout wrapper with the systemDefaults of directus_presets, the info panel counts, batch
// delete (and its error dialog) and batch edit, the empty state; the editor: the defaults of a new preset, the form
// fields, `scope` → `{role, user}`, a body with only the edited keys, always back to the list (R-41), delete, and the
// read-only layout preview with its query stored per layout name. The layout is a stand-in (the real layouts are
// tested in 014; the tabular `limit` 25 default is theirs); the directus_presets collection and fields are given to the
// stores here (the fixture set has none).
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import DrawerBatch from '../../../../components/drawers/DrawerBatch.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import { resetNotices, useNotices } from '../../../../composables/use-notices.ts';
import { useSidebarStore } from '../../../../layout/stores/sidebar.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { usePresetsStore } from '../../../../stores/presets.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, json, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import PresetItemRoute from './PresetItemRoute.vue';
import PresetsInfoSidebarDetail from './PresetsInfoSidebarDetail.vue';
import PresetsCollectionRoute from './PresetsCollectionRoute.vue';

vi.mock('../../../../layouts/index.ts', () => {
	const slot = (name: string) =>
		defineComponent({ inheritAttrs: false, setup: () => () => h('div', { [`data-${name}`]: '' }, name) });

	// A layout stand-in: shows what the wrapper gives it and lets the test select rows or change the query.
	const layout = (id: string) => ({
		id,
		name: `$t:layouts.${id}.${id}`,
		icon: 'table_rows',
		component: defineComponent({
			inheritAttrs: false,
			setup:
				(_, { attrs, slots }) =>
				() =>
					h(
						'div',
						{
							'data-layout': id,
							'data-collection': attrs['collection'],
							'data-readonly': String(attrs['readonly']),
							'data-query': JSON.stringify(attrs['layoutQuery'] ?? null),
							'data-options': JSON.stringify(attrs['layoutOptions'] ?? null),
							'data-filter': JSON.stringify(attrs['filter'] ?? null),
							'data-search': attrs['search'] ?? '',
						},
						[
							h('button', {
								'data-test': 'select',
								onClick: () => (attrs['onUpdate:selection'] as (v: unknown) => void)((window as any).__select),
							}),
							h('button', {
								'data-test': 'query',
								onClick: () => (attrs['onUpdate:layoutQuery'] as (v: unknown) => void)({ fields: ['title'] }),
							}),
							slots['no-items']?.(),
						],
					),
		}),
		slots: { options: slot('options'), sidebar: slot('sidebar'), actions: slot('actions') },
		setup: () => ({}),
	});

	const layouts = [layout('cards'), layout('tabular')];

	return { getLayouts: () => layouts, getLayout: (id: string) => layouts.find((l) => l.id === id) };
});

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	assertOnlyKnownRequests(calls(fetch));
});

const SLOW = 15_000;

let fetch: ReturnType<typeof mockFixtureApi>;

beforeEach(async () => {
	resetNotices();
	localStorage.clear();
	(window as any).__select = [];
	await replaceQueue();
});

const routes: RouteRecordRaw[] = [
	{ path: '/settings/presets', name: 'settings-presets-collection', component: PresetsCollectionRoute },
	{ path: '/settings/presets/:id', name: 'settings-presets-item', component: PresetItemRoute, props: true },
	{ path: '/:p(.*)*', component: { render: () => null } },
];

// directus/packages/system-data/src/fields/presets.yaml (the fields the list and the batch drawer read).
const presetField = (field: string, meta: Record<string, unknown> = {}, type = 'string') =>
	({
		collection: 'directus_presets',
		field,
		name: field,
		type,
		schema: { is_primary_key: field === 'id', has_auto_increment: field === 'id' },
		meta: { collection: 'directus_presets', field, hidden: false, readonly: false, width: 'half', ...meta },
	}) as unknown as Field;

const PRESET_FIELDS = [
	presetField('id', {}, 'integer'),
	presetField('bookmark'),
	presetField('user', { special: ['m2o'], display: 'related-values', display_options: { template: '{{ email }}' } }),
	presetField('role', { special: ['m2o'], display: 'related-values', display_options: { template: '{{ name }}' } }),
	presetField('collection'),
	presetField('layout'),
	presetField('layout_query', { hidden: true, special: ['cast-json'] }, 'json'),
];

const PRESETS_COLLECTION = {
	collection: 'directus_presets',
	meta: { collection: 'directus_presets', icon: 'bookmark', singleton: false, accountability: 'all' },
	schema: { name: 'directus_presets' },
};

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
					usePresetsStore().hydrate(),
				]);
				const collectionsStore = useCollectionsStore();
				collectionsStore.collections = [
					...collectionsStore.collections,
					collectionsStore.prepareCollectionForApp(PRESETS_COLLECTION as never),
				];
				useFieldsStore().fields.push(...PRESET_FIELDS);
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const COUNTS = ({ url }: { url: URL }) =>
	url.searchParams.has('meta')
		? json({ data: [{ id: 1 }, { id: 2 }], meta: { filter_count: 2, total_count: 5 } })
		: json({ data: loadSnapshot().presets ?? [] });

const button = (label: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === label);
const dialogButton = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(b) => b.textContent?.trim() === label,
	)!;
const layoutEl = () => document.querySelector<HTMLElement>('main [data-layout]');
const bodyOf = (method: string, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));

describe('PresetsCollectionRoute', () => {
	test(
		'the directus_presets systemDefaults on the tabular layout; the info panel counts bookmarks and presets',
		async () => {
			await setup('/settings/presets', { 'GET /presets': COUNTS });

			expect(document.querySelector('h1')?.textContent).toContain('Bookmarks');
			expect(layoutEl()?.dataset['layout']).toBe('tabular');
			expect(layoutEl()?.dataset['collection']).toBe('directus_presets');
			expect(JSON.parse(layoutEl()!.dataset['query']!)).toEqual({ fields: ['bookmark', 'collection', 'user', 'role'] });
			expect(JSON.parse(layoutEl()!.dataset['options']!)).toEqual({
				widths: { bookmark: 200, collection: 200, user: 200, role: 200 },
			});

			// The detail panel is a closed drawer below `xl` (happy-dom width): opening a section shows it.
			useSidebarStore().activeAccordionItem = 'presets';
			await flushPromises();
			expect(calls(fetch)).toContain(
				'GET /presets?filter[bookmark][_nnull]=true&fields=id&meta=filter_count,total_count',
			);
			expect(document.body.textContent).toMatch(/Bookmarks\s*2\s*Presets\s*3/);
			expect(document.querySelector('[data-sidebar]')).not.toBeNull();

			expect(button('Create Preset')?.getAttribute('href')).toBe('/settings/presets/+');
			expect(button('Delete')).toBeUndefined();
		},
		SLOW,
	);

	test(
		'batch delete: DELETE /presets with the selected ids; an error opens the something_went_wrong dialog',
		async () => {
			await setup('/settings/presets', {
				'GET /presets': COUNTS,
				'DELETE /presets': ({ init }: { init: RequestInit }) =>
					JSON.parse(String(init.body)).includes(3)
						? json({ errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] }, 403)
						: new Response(null, { status: 204 }),
			});

			(window as any).__select = [1, 2];
			document.querySelector<HTMLButtonElement>('[data-test="select"]')!.click();
			await flushPromises();

			button('Delete')!.click();
			await flushPromises();
			expect(document.querySelector('[role="dialog"]')?.textContent).toContain('2');
			dialogButton('Delete').click();
			await flushPromises();
			expect(bodyOf('DELETE', '/presets')).toEqual([[1, 2]]);
			expect(button('Delete')).toBeUndefined();

			(window as any).__select = [3];
			document.querySelector<HTMLButtonElement>('[data-test="select"]')!.click();
			await flushPromises();
			button('Delete')!.click();
			await flushPromises();
			dialogButton('Delete').click();
			await flushPromises();
			expect(document.body.textContent).toContain('Something went wrong');
		},
		SLOW,
	);

	test(
		'batch edit opens DrawerBatch with the selection; the empty state links to a new preset',
		async () => {
			const { wrapper } = await setup('/settings/presets', { 'GET /presets': COUNTS });

			(window as any).__select = [1];
			document.querySelector<HTMLButtonElement>('[data-test="select"]')!.click();
			await flushPromises();
			button('Edit')!.click();
			await flushPromises();
			expect(wrapper.findComponent(DrawerBatch).props()).toMatchObject({
				active: true,
				primaryKeys: [1],
				collection: 'directus_presets',
			});

			const empty = layoutEl()!.textContent!;
			expect(empty).toContain('No Presets');
			expect([...layoutEl()!.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/settings/presets/+')).toBe(
				true,
			);
		},
		SLOW,
	);
});

describe('PresetsInfoSidebarDetail', () => {
	test('GET /presets with the bookmark filter and the counts: bookmarks = filter_count, presets = total - filter', async () => {
		await mountLayout(PresetsInfoSidebarDetail, {
			beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { answers: { 'GET /presets': COUNTS } });
				useSidebarStore().activeAccordionItem = 'presets';
			},
		});
		await flushPromises();

		expect(calls(fetch)).toEqual([
			'GET /presets?filter[bookmark][_nnull]=true&fields=id&meta=filter_count,total_count',
		]);
		const text = document.body.textContent!.replace(/\s+/g, ' ');
		expect(text).toMatch(/Bookmarks\s*2\s*Presets\s*3/);
	});
});

describe('PresetItemRoute', () => {
	test(
		'a new preset: no request, the defaults, the notice until a collection is chosen, POST then the list',
		async () => {
			const { wrapper, router } = await setup('/settings/presets/+');

			expect(calls(fetch).filter((c) => c.startsWith('GET /presets/'))).toEqual([]);
			expect(document.querySelector('h1')?.textContent).toContain('Editing Preset');
			const form = wrapper.findComponent(BoForm);
			expect(form.props('initialValues')).toMatchObject({ layout: 'tabular', scope: 'all', collection: null });
			expect(button('Delete')).toHaveProperty('disabled', true);
			expect(button('Save')).toHaveProperty('disabled', true);
			expect(document.querySelector('main')?.textContent).toContain('No layout/collection selected yet');

			// The form fields of Directus item.vue: the collection choices keep three system collections.
			const fields = form.props('fields') as Field[];
			expect(fields.map((f) => f.field)).toEqual([
				'meta-group',
				'name',
				'icon',
				'color',
				'collection',
				'scope',
				'layout',
				'search',
				'filter',
				'layout-divider',
			]);
			const choices = (
				fields.find((f) => f.field === 'collection')!.meta!.options!['choices'] as { value: string }[]
			).map((c) => c.value);
			expect(choices).toContain('bo_content');
			expect(choices).toContain('directus_users');
			expect(choices).not.toContain('directus_presets');
			expect(fields.find((f) => f.field === 'scope')!.meta!.interface).toBe('system-scope');
			expect(fields.find((f) => f.field === 'layout')!.meta!.options!['choices']).toEqual([
				{ text: 'Cards', value: 'cards' },
				{ text: 'Table', value: 'tabular' },
			]);

			form.vm.$emit('update:modelValue', { name: 'Mine', collection: 'bo_content', scope: 'role_r1' });
			await flushPromises();
			expect(layoutEl()?.dataset).toMatchObject({ layout: 'tabular', collection: 'bo_content', readonly: 'true' });

			button('Save')!.click();
			await flushPromises();
			expect(bodyOf('POST', '/presets')).toEqual([
				{ bookmark: 'Mine', collection: 'bo_content', role: 'r1', user: null },
			]);
			expect(router.currentRoute.value.name).toBe('settings-presets-collection');
		},
		SLOW,
	);

	test(
		'an existing preset: GET /presets/<id>, its scope, the preview query per layout; PATCH only the edited keys',
		async () => {
			const preset = loadSnapshot().presets!.find((p) => p['id'] === 2)!;
			const { wrapper, router } = await setup('/settings/presets/2');

			expect(calls(fetch)).toContain('GET /presets/2');
			const form = wrapper.findComponent(BoForm);
			expect(form.props('initialValues')).toMatchObject({ id: 2, scope: `role_${preset['role']}`, layout: 'tabular' });
			expect(JSON.parse(layoutEl()!.dataset['query']!)).toEqual(preset['layout_query'].tabular);
			expect(button('Delete')).toHaveProperty('disabled', false);
			// The layout sidebar and, in the `layout_options` section, the layout options of the preview.
			// Below `xl` the detail panel is a drawer that a late focus can close again on a loaded CI runner (collapse
			// clears the open section): open it on each try.
			await vi.waitFor(
				() => {
					useSidebarStore().activeAccordionItem = 'layout-options';
					expect(document.querySelector('[data-sidebar]')).not.toBeNull();
					expect(document.querySelector('[data-options=""]')).not.toBeNull();
				},
				{ timeout: 5000 },
			);

			document.querySelector<HTMLButtonElement>('[data-test="query"]')!.click();
			await flushPromises();
			form.vm.$emit('update:modelValue', { ...form.props('modelValue'), scope: 'user_u1', search: 'abc' });
			await flushPromises();
			expect(layoutEl()?.dataset['search']).toBe('abc');

			button('Save')!.click();
			await flushPromises();
			expect(bodyOf('PATCH', '/presets/2')).toEqual([
				{ layout_query: { tabular: { fields: ['title'] } }, search: 'abc', user: 'u1', role: null },
			]);
			expect(router.currentRoute.value.name).toBe('settings-presets-collection');
		},
		SLOW,
	);

	test(
		'scope `all` clears role and user; a failed save opens the error dialog, then the edits guard asks (as Directus)',
		async () => {
			const { wrapper, router } = await setup('/settings/presets/2', {
				'PATCH /presets/2': () => json({ errors: [{ message: 'Nope', extensions: { code: 'FORBIDDEN' } }] }, 403),
			});

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { scope: 'all' });
			await flushPromises();
			button('Save')!.click();
			await flushPromises();

			expect(bodyOf('PATCH', '/presets/2')).toEqual([{ role: null, user: null }]);
			expect(useNotices().dialogs.value).toHaveLength(1);
			// item.vue pushes to the list in `finally`; the edits are kept, so useEditsGuard stops it with its dialog.
			expect(document.body.textContent).toContain('Unsaved Changes');
			expect(router.currentRoute.value.name).toBe('settings-presets-item');
		},
		SLOW,
	);

	test(
		'delete: DELETE /presets with [id], then the list',
		async () => {
			const { router } = await setup('/settings/presets/2');

			button('Delete')!.click();
			await flushPromises();
			dialogButton('Delete').click();
			await flushPromises();

			expect(bodyOf('DELETE', '/presets')).toEqual([[2]]);
			expect(router.currentRoute.value.name).toBe('settings-presets-collection');
		},
		SLOW,
	);
});
