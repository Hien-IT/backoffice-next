// DR has no test for the translations routes (spec 016 T102, US6-4, US6-5, FR-086, contracts/api-calls.md
// #153, #154, #176): the list on the 014 layout wrapper (create link, batch delete and edit, the empty state); the item
// page on use-item with the translations.yaml form: create, save and stay (replace to the new id), delete, SaveOptions,
// refreshCurrentLanguage after every write, revisions and comments for an existing item, a failed load → not found.
// The layout is a stand-in (the real layouts are tested in 014); the directus_translations collection and fields
// (directus/packages/system-data/src/fields/translations.yaml) are given to the stores here.
import type { Field } from '@directus/types';
import { enableAutoUnmount, flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView, type RouteRecordRaw } from 'vue-router';
import { replaceQueue } from '../../../../api/sdk.ts';
import DrawerBatch from '../../../../components/drawers/DrawerBatch.vue';
import BoForm from '../../../../components/form/BoForm.vue';
import SaveOptions from '../../../../components/SaveOptions.vue';
import CommentsSidebarDetail from '../../../../components/sidebar/CommentsSidebarDetail.vue';
import RevisionsSidebarDetail from '../../../../components/sidebar/RevisionsSidebarDetail.vue';
import { resetNotices } from '../../../../composables/use-notices.ts';
import { refreshCurrentLanguage } from '../../../../lang/refresh-current-language.ts';
import { useSidebarStore } from '../../../../layout/stores/sidebar.ts';
import { useCollectionsStore } from '../../../../stores/collections.ts';
import { useFieldsStore } from '../../../../stores/fields.ts';
import { usePermissionsStore } from '../../../../stores/permissions.ts';
import { usePresetsStore } from '../../../../stores/presets.ts';
import { useRelationsStore } from '../../../../stores/relations.ts';
import { useUserStore } from '../../../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../../../test-utils/fetch.ts';
import { loadSnapshot } from '../../../../test-utils/fixtures.ts';
import { mountLayout } from '../../../../test-utils/layout.ts';
import TranslationItemRoute from './TranslationItemRoute.vue';
import TranslationsCollectionRoute from './TranslationsCollectionRoute.vue';

vi.mock('../../../../lang/refresh-current-language.ts', () => ({ refreshCurrentLanguage: vi.fn() }));

vi.mock('../../../../layouts/index.ts', () => {
	const slot = (name: string) =>
		defineComponent({ inheritAttrs: false, setup: () => () => h('div', { [`data-${name}`]: '' }, name) });

	const tabular = {
		id: 'tabular',
		name: 'Table',
		icon: 'table_rows',
		component: defineComponent({
			inheritAttrs: false,
			setup:
				(_, { attrs, slots }) =>
				() =>
					h('div', { 'data-layout': '', 'data-collection': attrs['collection'] }, [
						h('button', {
							'data-test': 'select',
							onClick: () => (attrs['onUpdate:selection'] as (v: unknown) => void)((window as any).__select),
						}),
						slots['no-items']?.(),
					]),
		}),
		slots: { options: slot('options'), sidebar: slot('sidebar'), actions: slot('actions') },
		setup: () => ({}),
	};

	return { getLayouts: () => [tabular], getLayout: (id: string) => (id === 'tabular' ? tabular : undefined) };
});

enableAutoUnmount(afterEach);
afterEach(() => {
	vi.unstubAllGlobals();
	vi.mocked(refreshCurrentLanguage).mockReset();
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
	{ path: '/settings/translations', name: 'settings-translations-collection', component: TranslationsCollectionRoute },
	{
		path: '/settings/translations/:primaryKey',
		name: 'settings-translations-item',
		component: TranslationItemRoute,
		props: true,
	},
	{ path: '/:p(.*)*', component: { render: () => null } },
];

const translationField = (field: string, sort: number, meta: Record<string, unknown>, type = 'string') =>
	({
		collection: 'directus_translations',
		field,
		name: field,
		type,
		schema: { is_primary_key: field === 'id', has_auto_increment: false, default_value: null },
		meta: { collection: 'directus_translations', field, sort, hidden: false, readonly: false, width: 'full', ...meta },
	}) as unknown as Field;

const TRANSLATION_FIELDS = [
	translationField('id', 1, { hidden: true, special: ['uuid'] }, 'uuid'),
	translationField('key', 2, {
		width: 'half',
		required: true,
		interface: 'input',
		options: { font: 'monospace', placeholder: '$t:translation_key_placeholder' },
	}),
	translationField('language', 3, { width: 'half', required: true, interface: 'system-language' }),
	translationField('value', 4, {
		required: true,
		interface: 'input-multiline',
		options: { placeholder: '$t:enter_a_value' },
	}),
];

const TRANSLATIONS_COLLECTION = {
	collection: 'directus_translations',
	meta: { collection: 'directus_translations', icon: 'translate', singleton: false, accountability: 'all' },
	schema: { name: 'directus_translations' },
};

const ROW = { id: 't-1', key: 'bo_hello', language: 'vi-VN', value: 'Xin chào' };

async function setup(path: string) {
	const mounted = await mountLayout(
		{ render: () => h(RouterView) },
		{
			routes,
			path,
			async beforeMount() {
				fetch = mockFixtureApi(loadSnapshot(), { user: 'admin' });
				(fetch as unknown as { db: Record<string, unknown[]> }).db['directus_translations']!.push({ ...ROW });
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
					collectionsStore.prepareCollectionForApp(TRANSLATIONS_COLLECTION as never),
				];
				useFieldsStore().fields.push(...TRANSLATION_FIELDS);
			},
		},
	);

	await flushPromises();
	await flushPromises();
	return mounted;
}

const button = (label: string) =>
	[...document.querySelectorAll<HTMLElement>('button, a')].find((el) => el.getAttribute('aria-label') === label);
const dialogButton = (label: string) =>
	[...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
		(b) => b.textContent?.trim() === label,
	)!;
const bodyOf = (method: string, path: string) =>
	fetch.mock.calls
		.filter(([input, init]) => init?.method === method && new URL(String(input)).pathname === path)
		.map(([, init]) => JSON.parse(String(init!.body)));

describe('TranslationsCollectionRoute', () => {
	test(
		'title, the layout of directus_translations, the create link and the empty state',
		async () => {
			await setup('/settings/translations');

			expect(document.querySelector('h1')?.textContent).toContain('Translations');
			expect(document.querySelector<HTMLElement>('main [data-layout]')?.dataset['collection']).toBe(
				'directus_translations',
			);
			expect(button('Create Custom Translation')?.getAttribute('href')).toBe('/settings/translations/+');
			expect(document.querySelector('main')?.textContent).toContain('No Custom Translations');
			expect(button('Delete')).toBeUndefined();
		},
		SLOW,
	);

	test(
		'batch delete sends DELETE /translations with the selected keys; batch edit opens DrawerBatch',
		async () => {
			const { wrapper } = await setup('/settings/translations');

			(window as any).__select = ['t-1'];
			document.querySelector<HTMLButtonElement>('[data-test="select"]')!.click();
			await flushPromises();

			button('Edit')!.click();
			await flushPromises();
			expect(wrapper.findComponent(DrawerBatch).props()).toMatchObject({
				active: true,
				primaryKeys: ['t-1'],
				collection: 'directus_translations',
			});

			button('Delete')!.click();
			await flushPromises();
			dialogButton('Delete').click();
			await flushPromises();
			expect(bodyOf('DELETE', '/translations')).toEqual([['t-1']]);
			expect(button('Delete')).toBeUndefined();
		},
		SLOW,
	);
});

describe('TranslationItemRoute', () => {
	test(
		'create: the directus_translations form, save as copy disabled; save → POST, refresh the language, the list',
		async () => {
			const { wrapper, router } = await setup('/settings/translations/+');

			expect(document.querySelector('h1')?.textContent).toContain('Create Custom Translation');
			expect(button('Delete')).toBeUndefined();
			// As DR: the system fields have a `default_value` (null), so `isSavable` is already true for a new item.
			expect(button('Save')).toHaveProperty('disabled', false);
			expect(wrapper.findComponent(BoForm).props('collection')).toBe('directus_translations');
			expect(wrapper.findComponent(RevisionsSidebarDetail).exists()).toBe(false);

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { key: 'bo_bye', language: 'en-US', value: 'Bye' });
			await flushPromises();
			expect(wrapper.findComponent(SaveOptions).props('disabledOptions')).toEqual(['save-as-copy']);

			button('Save')!.click();
			await flushPromises();
			expect(bodyOf('POST', '/translations')).toEqual([{ key: 'bo_bye', language: 'en-US', value: 'Bye' }]);
			expect(refreshCurrentLanguage).toHaveBeenCalledTimes(1);
			expect(router.currentRoute.value.name).toBe('settings-translations-collection');
		},
		SLOW,
	);

	test(
		'create, save and stay: the page moves to the new key',
		async () => {
			const { wrapper, router } = await setup('/settings/translations/+');

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { key: 'bo_bye', language: 'en-US', value: 'Bye' });
			await flushPromises();
			wrapper.findComponent(SaveOptions).vm.$emit('save-and-stay');
			await flushPromises();

			expect(refreshCurrentLanguage).toHaveBeenCalledTimes(1);
			expect(router.currentRoute.value.name).toBe('settings-translations-item');
			expect(router.currentRoute.value.params['primaryKey']).toMatch(/^bo-new-/);
		},
		SLOW,
	);

	test(
		'edit: GET /translations/<id>, PATCH only the edits, revisions and comments in the panel; delete',
		async () => {
			const { wrapper, router } = await setup('/settings/translations/t-1');

			expect(calls(fetch).some((c) => c.startsWith('GET /translations/t-1'))).toBe(true);
			expect(document.querySelector('h1')?.textContent).toContain('Edit Custom Translation');
			expect(wrapper.findComponent(BoForm).props('initialValues')).toMatchObject(ROW);
			// The detail panel is a closed drawer below `xl` (happy-dom width): opening a section shows it.
			useSidebarStore().activeAccordionItem = 'revisions';
			await flushPromises();
			expect(wrapper.findComponent(RevisionsSidebarDetail).props('primaryKey')).toBe('t-1');
			expect(wrapper.findComponent(CommentsSidebarDetail).props('primaryKey')).toBe('t-1');
			expect(button('Delete')).toHaveProperty('disabled', false);

			wrapper.findComponent(BoForm).vm.$emit('update:modelValue', { value: 'Chào' });
			await flushPromises();
			expect(wrapper.findComponent(SaveOptions).props('disabledOptions')).toEqual([]);
			wrapper.findComponent(SaveOptions).vm.$emit('save-and-stay');
			await flushPromises();
			expect(bodyOf('PATCH', '/translations/t-1')).toEqual([{ value: 'Chào' }]);
			expect(refreshCurrentLanguage).toHaveBeenCalledTimes(1);
			expect(router.currentRoute.value.params['primaryKey']).toBe('t-1');

			button('Delete')!.click();
			await flushPromises();
			dialogButton('Delete').click();
			await flushPromises();
			expect(calls(fetch)).toContain('DELETE /translations/t-1');
			expect(refreshCurrentLanguage).toHaveBeenCalledTimes(2);
			expect(router.currentRoute.value.name).toBe('settings-translations-collection');
		},
		SLOW,
	);

	test(
		'a failed load shows the not-found page',
		async () => {
			await setup('/settings/translations/missing');

			expect(document.querySelector('h1')?.textContent).toContain('Page Not Found');
		},
		SLOW,
	);
});
