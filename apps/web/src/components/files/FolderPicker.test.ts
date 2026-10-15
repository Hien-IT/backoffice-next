// Ported from directus/app/src/views/private/components/folder-picker.vue (behaviour); the tests are ours.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { replaceQueue } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import { assertOnlyKnownRequests, calls, mockApi } from '../../test-utils/fetch.ts';
import FolderPicker from './FolderPicker.vue';

enableAutoUnmount(afterEach);

const FOLDERS = [
	{ id: 'a', name: 'Alpha', parent: null },
	{ id: 'b', name: 'Beta', parent: 'a' },
	{ id: 'c', name: 'Gamma', parent: 'b' },
	{ id: 'd', name: 'Delta', parent: null },
];

beforeEach(async () => {
	setActivePinia(createPinia());
	await replaceQueue();
});

const global = { plugins: [i18n] };
const names = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[role="treeitem"] .truncate').map((row) => row.text());

test('loads the folders once and shows the library root open', async () => {
	const fetch = mockApi({ 'GET /folders': FOLDERS });
	const wrapper = mount(FolderPicker, { props: { modelValue: null }, global });
	await flushPromises();

	expect(calls(fetch)).toEqual(['GET /folders?sort=name&limit=-1']);
	assertOnlyKnownRequests(calls(fetch));
	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Delta']);
	expect(wrapper.get('[aria-selected="true"] .truncate').text()).toBe('File Library');
});

test('the parents of the selected folder open', async () => {
	mockApi({ 'GET /folders': FOLDERS });
	const wrapper = mount(FolderPicker, { props: { modelValue: 'c' }, global });
	await flushPromises();

	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Beta', 'Gamma', 'Delta']);
	expect(wrapper.get('[aria-selected="true"] .truncate').text()).toBe('Gamma');
	expect(wrapper.get('[data-key="c"]').attributes('aria-level')).toBe('4');
});

test('click and Enter select; the root selects null', async () => {
	mockApi({ 'GET /folders': FOLDERS });
	const wrapper = mount(FolderPicker, { props: { modelValue: 'a' }, global });
	await flushPromises();

	await wrapper.get('[data-key="d"] [data-tree-row]').trigger('click');
	await wrapper.get('[data-key="root"] [data-tree-row]').trigger('keydown', { key: 'Enter' });

	expect(wrapper.emitted('update:modelValue')).toEqual([['d'], [null]]);
});

test('a disabled folder can neither be selected nor opened', async () => {
	mockApi({ 'GET /folders': FOLDERS });
	const wrapper = mount(FolderPicker, { props: { modelValue: null, disabledFolders: ['a'] }, global });
	await flushPromises();

	const row = wrapper.get('[data-key="a"]');
	expect(row.attributes('aria-disabled')).toBe('true');
	expect(row.attributes('aria-expanded')).toBeUndefined();

	await row.get('[data-tree-row]').trigger('click');
	expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Delta']);
});

test('tree keyboard: Right opens then moves in, Left goes back to the parent', async () => {
	mockApi({ 'GET /folders': FOLDERS });
	const wrapper = mount(FolderPicker, { props: { modelValue: null }, global, attachTo: document.body });
	await flushPromises();

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('keydown', { key: 'ArrowRight' });
	expect(names(wrapper)).toEqual(['File Library', 'Alpha', 'Beta', 'Delta']);

	await wrapper.get('[data-key="a"] [data-tree-row]').trigger('keydown', { key: 'ArrowRight' });
	await flushPromises();
	expect(document.activeElement?.closest('[role="treeitem"]')?.getAttribute('data-key')).toBe('b');

	await wrapper.get('[data-key="b"] [data-tree-row]').trigger('keydown', { key: 'ArrowLeft' });
	await flushPromises();
	expect(document.activeElement?.closest('[role="treeitem"]')?.getAttribute('data-key')).toBe('a');
});
