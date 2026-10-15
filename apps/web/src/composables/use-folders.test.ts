// Ported from directus/app/src/composables/use-folders.test.ts
// Backoffice: the folder state is module level, so each test resets it; extra tests for one load per app and errors.
import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, toRefs } from 'vue';
import { type FolderRaw, nestFolders, resetFoldersForTests, useFolders } from './use-folders.ts';

const folders: FolderRaw[] = [
	{ id: '90758df2-0578-4353-9749-0ed72d0dd582', name: 'gg', parent: '1027ca54-ce0f-4a70-8221-bd322434589e' },
	{ id: 'cf7f4df0-fbe6-45b7-b435-d48d789b653c', name: 'my folder 2', parent: '42441e05-1bb4-4f23-8523-57aa355867ed' },
	{ id: '1027ca54-ce0f-4a70-8221-bd322434589e', name: 'my folder 3', parent: null },
	{ id: '42441e05-1bb4-4f23-8523-57aa355867ed', name: 'my folder 1', parent: null },
	{ id: 'a4a60dc8-e9f8-4f00-b38c-5a417d9bb7bc', name: 'wee', parent: '48900cc0-e032-41f2-ae91-bb499de423f1' },
	{ id: '48900cc0-e032-41f2-ae91-bb499de423f1', name: 'www', parent: '1027ca54-ce0f-4a70-8221-bd322434589e' },
];

const fetchAll = vi.hoisted(() => vi.fn());

vi.mock('../utils/fetch-all.ts', () => ({ fetchAll }));

const TestComponent = defineComponent({
	props: ['rootFolder'], // eslint-disable-line vue/require-prop-types
	setup(props) {
		const { rootFolder } = toRefs(props);

		return useFolders(rootFolder);
	},
	render() {
		return h('div');
	},
});

beforeEach(() => {
	resetFoldersForTests();
	fetchAll.mockReset();
	fetchAll.mockResolvedValue(folders);
});

describe('test for useFolders', () => {
	test('without rootFolder', async () => {
		const wrapper = mount(TestComponent, { props: {} });

		await flushPromises();

		expect(wrapper.vm.folders).toEqual(folders);
		expect(wrapper.vm.openFolders).toEqual(['root']);

		expect(wrapper.vm.nestedFolders).toEqual([
			{
				id: '1027ca54-ce0f-4a70-8221-bd322434589e',
				name: 'my folder 3',
				parent: null,
				children: [
					{ id: '90758df2-0578-4353-9749-0ed72d0dd582', name: 'gg', parent: '1027ca54-ce0f-4a70-8221-bd322434589e' },
					{
						id: '48900cc0-e032-41f2-ae91-bb499de423f1',
						name: 'www',
						parent: '1027ca54-ce0f-4a70-8221-bd322434589e',
						children: [
							{ id: 'a4a60dc8-e9f8-4f00-b38c-5a417d9bb7bc', name: 'wee', parent: '48900cc0-e032-41f2-ae91-bb499de423f1' },
						],
					},
				],
			},
			{
				id: '42441e05-1bb4-4f23-8523-57aa355867ed',
				name: 'my folder 1',
				parent: null,
				children: [
					{ id: 'cf7f4df0-fbe6-45b7-b435-d48d789b653c', name: 'my folder 2', parent: '42441e05-1bb4-4f23-8523-57aa355867ed' },
				],
			},
		]);

		expect(fetchAll).toHaveBeenCalledWith('/folders', { params: { sort: 'name' } });
	});

	test('with rootFolder', async () => {
		const wrapper = mount(TestComponent, { props: { rootFolder: '1027ca54-ce0f-4a70-8221-bd322434589e' } });

		await flushPromises();

		expect(wrapper.vm.folders).toEqual(folders);
		expect(wrapper.vm.openFolders).toEqual(['1027ca54-ce0f-4a70-8221-bd322434589e']);

		expect(wrapper.vm.nestedFolders).toEqual([
			{ id: '90758df2-0578-4353-9749-0ed72d0dd582', name: 'gg', parent: '1027ca54-ce0f-4a70-8221-bd322434589e' },
			{
				id: '48900cc0-e032-41f2-ae91-bb499de423f1',
				name: 'www',
				parent: '1027ca54-ce0f-4a70-8221-bd322434589e',
				children: [
					{ id: 'a4a60dc8-e9f8-4f00-b38c-5a417d9bb7bc', name: 'wee', parent: '48900cc0-e032-41f2-ae91-bb499de423f1' },
				],
			},
		]);
	});
});

test('folders load once for the whole app', async () => {
	mount(TestComponent, { props: {} });
	await flushPromises();
	mount(TestComponent, { props: {} });
	await flushPromises();

	expect(fetchAll).toHaveBeenCalledTimes(1);
});

test('a failed load keeps the tree empty and logs the error', async () => {
	const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	fetchAll.mockRejectedValue(new Error('page 2 failed'));

	const wrapper = mount(TestComponent, { props: {} });
	await flushPromises();

	expect(wrapper.vm.folders).toBeNull();
	expect(wrapper.vm.loading).toBe(false);
	expect(warn).toHaveBeenCalled();
	warn.mockRestore();
});

test('a parent cycle leaves those folders out of the tree without hanging (R-39)', () => {
	expect(
		nestFolders([
			{ id: 'a', name: 'a', parent: 'b' },
			{ id: 'b', name: 'b', parent: 'a' },
			{ id: 'c', name: 'c', parent: null },
		]),
	).toEqual([{ id: 'c', name: 'c', parent: null }]);
});
