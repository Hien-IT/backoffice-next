// Ported from directus/app/src/views/private/components/drawer-files.test.ts
// Backoffice: the folder target comes from the folder select (files-navigation.vue is not ported), the real
// useSessionStorage runs on happy-dom's sessionStorage, and the folder filter is checked instead of mocked. Added: the
// filter given to DrawerCollection, the folders request, the fixture files and the BoUpload `library` pattern.
import type { Filter } from '@directus/types';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { useCollectionsStore } from '../../stores/collections.ts';
import { useFieldsStore } from '../../stores/fields.ts';
import { useRelationsStore } from '../../stores/relations.ts';
import { useUserStore } from '../../stores/user.ts';
import { assertOnlyKnownRequests, calls, mockFixtureApi } from '../../test-utils/fetch.ts';
import { loadSnapshot } from '../../test-utils/fixtures.ts';
import BoSelect from '../BoSelect.vue';
import BoUpload from '../files/BoUpload.vue';
import DrawerCollection from './DrawerCollection.vue';
import DrawerFiles from './DrawerFiles.vue';

enableAutoUnmount(afterEach);

let fetch: ReturnType<typeof mockFixtureApi>;

const DrawerCollectionStub = defineComponent({
	name: 'DrawerCollection',
	props: { filter: { type: Object, default: undefined }, collection: { type: String, default: undefined } },
	setup:
		(_, { slots }) =>
		() =>
			h('div', slots['sidebar']?.()),
});

const global = () => ({ stubs: { DrawerCollection: DrawerCollectionStub }, plugins: [i18n] });

beforeEach(async () => {
	sessionStorage.clear();
	vi.unstubAllGlobals();
	await replaceQueue();
	setActivePinia(createPinia());
	fetch = mockFixtureApi(loadSnapshot());
	await useUserStore().hydrate();
});

afterEach(() => {
	assertOnlyKnownRequests(calls(fetch));
});

async function mountFiles(props: Record<string, unknown> = {}) {
	const wrapper = mount(DrawerFiles, { props, global: global() });
	await flushPromises();
	return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountFiles>>;

const nav = (wrapper: Wrapper) => wrapper.findComponent(BoSelect);

async function navigate(wrapper: Wrapper, value: string) {
	nav(wrapper).vm.$emit('update:modelValue', value);
	await flushPromises();
}

describe('DrawerFiles', () => {
	// T094: with `active` declared, `onUpdate:active` did not fall through, so the drawer never closed.
	test('closing the drawer (Cancel, Esc, Save) emits update:active false to the parent', async () => {
		const wrapper = await mountFiles({ active: true });

		wrapper.findComponent(DrawerCollectionStub).vm.$emit('update:active', false);
		expect(wrapper.emitted('update:active')).toEqual([[false]]);
	});

	test('persists folder state across unmount/remount cycles', async () => {
		const wrapper = await mountFiles();

		expect(nav(wrapper).props('modelValue')).toBe('root');

		await navigate(wrapper, 'subfolder-123');
		expect(nav(wrapper).props('modelValue')).toBe('subfolder-123');

		wrapper.unmount();

		const wrapper2 = await mountFiles();
		expect(nav(wrapper2).props('modelValue')).toBe('subfolder-123');
	});

	test('persists special folder state across unmount/remount cycles', async () => {
		const wrapper = await mountFiles({ folder: 'test-special' });

		await navigate(wrapper, 'special:mine');
		expect(nav(wrapper).props('modelValue')).toBe('special:mine');

		wrapper.unmount();

		const wrapper2 = await mountFiles({ folder: 'test-special' });
		expect(nav(wrapper2).props('modelValue')).toBe('special:mine');
	});

	test('isolates persisted state between different field props without a root folder', async () => {
		const wrapperA = await mountFiles({ field: 'avatar' });
		await navigate(wrapperA, 'photos');
		wrapperA.unmount();

		const wrapperB = await mountFiles({ field: 'banner' });
		expect(nav(wrapperB).props('modelValue')).toBe('root');
		wrapperB.unmount();

		const wrapperA2 = await mountFiles({ field: 'avatar' });
		expect(nav(wrapperA2).props('modelValue')).toBe('photos');
	});

	test('isolates persisted state between different fields sharing the same root folder', async () => {
		const wrapperA = await mountFiles({ field: 'avatar', folder: 'root-x' });
		await navigate(wrapperA, 'subfolder-avatar');
		wrapperA.unmount();

		const wrapperB = await mountFiles({ field: 'banner', folder: 'root-x' });
		expect(nav(wrapperB).props('modelValue')).toBe('root-x');
		wrapperB.unmount();

		const wrapperA2 = await mountFiles({ field: 'avatar', folder: 'root-x' });
		expect(nav(wrapperA2).props('modelValue')).toBe('subfolder-avatar');
	});

	test('isolates persisted state between same field on different collections', async () => {
		const wrapperA = await mountFiles({ collection: 'articles', field: 'thumbnail' });
		await navigate(wrapperA, 'article-images');
		wrapperA.unmount();

		const wrapperB = await mountFiles({ collection: 'authors', field: 'thumbnail' });
		expect(nav(wrapperB).props('modelValue')).toBe('root');
		wrapperB.unmount();

		const wrapperA2 = await mountFiles({ collection: 'articles', field: 'thumbnail' });
		expect(nav(wrapperA2).props('modelValue')).toBe('article-images');
	});

	test('isolates persisted state between different root folder props', async () => {
		const wrapperA = await mountFiles({ folder: 'root-a' });
		await navigate(wrapperA, 'subfolder-in-a');
		wrapperA.unmount();

		const wrapperB = await mountFiles({ folder: 'root-b' });
		expect(nav(wrapperB).props('modelValue')).toBe('root-b');
		await navigate(wrapperB, 'subfolder-in-b');
		wrapperB.unmount();

		const wrapperA2 = await mountFiles({ folder: 'root-a' });
		expect(nav(wrapperA2).props('modelValue')).toBe('subfolder-in-a');
	});
});

describe('folder filter', () => {
	const filterOf = (wrapper: Wrapper) => wrapper.findComponent(DrawerCollectionStub).props('filter') as Filter;
	const mime: Filter = { type: { _starts_with: 'image/' } };

	test('root: files without folder, merged with the interface filter (mime)', async () => {
		const wrapper = await mountFiles({ filter: mime });

		expect(filterOf(wrapper)).toEqual({
			_and: [mime, { _and: [{ type: { _nnull: true } }, { folder: { _null: true } }] }],
		});
	});

	test('a folder, my files, recent files and all files', async () => {
		const wrapper = await mountFiles();
		const folderPart = () => (filterOf(wrapper) as any)._and.slice(1);

		await navigate(wrapper, 'bo-2');
		expect(folderPart()).toEqual([{ folder: { _eq: 'bo-2' } }]);

		await navigate(wrapper, 'special:mine');
		expect(folderPart()).toEqual([{ uploaded_by: { _eq: useUserStore().currentUser!['id' as never] } }]);

		await navigate(wrapper, 'special:recent');
		expect(Object.keys(folderPart()[0])).toEqual(['uploaded_on']);

		await navigate(wrapper, 'special:all');
		expect(folderPart()).toEqual([]);

		await navigate(wrapper, 'root');
		expect(folderPart()).toEqual([{ folder: { _null: true } }]);
	});

	test('folders load once when the drawer opens (GET /folders), listed under the root, then the special folders', async () => {
		const wrapper = await mountFiles();
		expect(calls(fetch).some((call) => call.startsWith('GET /folders'))).toBe(false);

		await wrapper.setProps({ active: true });
		await flushPromises();
		await wrapper.setProps({ active: false });
		await wrapper.setProps({ active: true });
		await flushPromises();

		expect(calls(fetch).filter((call) => call.startsWith('GET /folders'))).toEqual(['GET /folders?sort=name&limit=-1']);
		expect((nav(wrapper).props('items') as { text: string }[]).map((item) => item.text.trim())).toEqual([
			'File Library',
			'bo-fixtures',
			'All Files',
			'My Files',
			'Recent Files',
		]);
	});
});

describe('with the files drawer and BoUpload', () => {
	beforeEach(async () => {
		await Promise.all([useFieldsStore().hydrate(), useRelationsStore().hydrate(), useCollectionsStore().hydrate()]);
	});

	test('`library` opens the drawer on `folder`; the chosen file goes to setSelection and BoUpload emits it', async () => {
		const onInput = vi.fn();

		const Host = defineComponent(() => {
			const libraryOpen = ref(false);
			const upload = ref<InstanceType<typeof BoUpload>>();

			return () => [
				h(BoUpload, { ref: upload, folder: 'bo-2', onLibrary: () => (libraryOpen.value = true), onInput }),
				h(DrawerFiles, {
					folder: 'bo-2',
					active: libraryOpen.value,
					'onUpdate:active': (value: boolean) => (libraryOpen.value = value),
					onInput: (keys: (string | number)[] | null) => upload.value?.setSelection(keys),
				}),
			];
		});

		const host = mount(Host, { global: { plugins: [i18n] }, attachTo: document.body });
		host.findComponent(BoUpload).vm.$emit('library');
		await vi.waitFor(() => expect(document.querySelectorAll('[role="dialog"] tbody tr')).toHaveLength(3));

		expect(host.findComponent(DrawerCollection).props('filter')).toEqual({
			_and: [{ type: { _nnull: true } }, { folder: { _eq: 'bo-2' } }],
		});

		document.querySelector<HTMLElement>('[role="dialog"] tbody [role="checkbox"]')!.click();
		await flushPromises();
		document.querySelector<HTMLButtonElement>('[role="dialog"] header button[aria-label="Save"]')!.click();
		await vi.waitFor(() => expect(onInput).toHaveBeenCalled());

		expect(onInput.mock.calls[0]![0]).toMatchObject({ id: expect.any(String) });
		expect(calls(fetch).some((call) => /^GET \/files\/bo-\d$/.test(call.split('?')[0]!))).toBe(true);
	});
});
