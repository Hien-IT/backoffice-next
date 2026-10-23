// Feature 016 (T090): system-folder as DR: the path of the chosen folder from its parents (useFolders), the root
// name without a value, the picker tree with that root name, choosing a folder emits its id and the root emits null.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { replaceQueue } from '../../../api/sdk.ts';
import FolderPicker from '../../../components/files/FolderPicker.vue';
import { i18n } from '../../../lang/index.ts';
import { mockApi } from '../../../test-utils/fetch.ts';
import SystemFolder from './SystemFolder.vue';

enableAutoUnmount(afterEach);

const t = (key: string) => i18n.global.t(key);

const FOLDERS = [
	{ id: 'f1', name: 'Images', parent: null },
	{ id: 'f2', name: 'Products', parent: 'f1' },
];

let pinia: ReturnType<typeof createPinia>;

beforeEach(async () => {
	await replaceQueue();
	pinia = createPinia();
	setActivePinia(pinia);
	mockApi({ 'GET /folders': FOLDERS });
});

// As the Datetime test: the popover content is always rendered (happy-dom does not open the Reka popover).
async function render(value: string | null) {
	const wrapper = mount(SystemFolder, {
		props: { value },
		global: {
			plugins: [pinia, i18n],
			stubs: {
				PopoverPortal: { template: '<div><slot /></div>' },
				PopoverContent: { template: '<div><slot /></div>' },
			},
		},
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

test('the path of a nested folder; the root name without value', async () => {
	expect((await render('f2')).get('input').element.value).toBe('Images / Products');
	expect((await render(null)).get('input').element.value).toBe(t('interfaces.system-folder.root_name'));
});

test('the picker uses the root name; a folder emits its id, the root emits null', async () => {
	const wrapper = await render('f2');

	expect(wrapper.find(`button[aria-label="${t('interfaces.system-folder.description')}"]`).exists()).toBe(true);
	const picker = wrapper.findComponent(FolderPicker);
	expect(picker.props('rootLabel')).toBe(t('interfaces.system-folder.root_name'));
	expect(document.body.textContent).toContain(t('interfaces.system-folder.root_name'));

	picker.vm.$emit('update:modelValue', 'f1');
	picker.vm.$emit('update:modelValue', null);
	expect(wrapper.emitted('input')).toEqual([['f1'], [null]]);
});
