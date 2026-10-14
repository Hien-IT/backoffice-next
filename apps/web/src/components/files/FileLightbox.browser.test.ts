import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import BoUpload from './BoUpload.vue';
import FileLightbox from './FileLightbox.vue';

// Focus handling of the lightbox and the keyboard path of the upload zone (chromium).
enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	createSdk('https://api.test/');
});

const file = {
	id: 'img',
	title: 'Cat',
	type: 'image/png',
	modified_on: null as unknown as string,
	width: 1,
	height: 1,
};

test('the lightbox traps focus, Esc closes it and focus returns to the opener', async () => {
	const Harness = defineComponent(() => {
		const open = ref(false);
		return () =>
			h(
				FileLightbox,
				{ file, modelValue: open.value, 'onUpdate:modelValue': (v: boolean) => (open.value = v) },
				{ activator: ({ on }: { on: () => void }) => h('button', { id: 'opener', onClick: on }, 'Preview') },
			);
	});
	mount(Harness, { global: { plugins: [i18n] }, attachTo: document.body });

	document.getElementById('opener')!.focus();
	await userEvent.keyboard('{Enter}');
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());

	const dialog = document.querySelector('[role="dialog"]')!;
	for (let i = 0; i < 3; i++) {
		await userEvent.keyboard('{Tab}');
		expect(dialog.contains(document.activeElement)).toBe(true);
	}

	await userEvent.keyboard('{Escape}');
	await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
	await vi.waitFor(() => expect(document.activeElement?.id).toBe('opener'));
});

test('the upload button opens the file chooser from the keyboard', async () => {
	const wrapper = mount(BoUpload, { global: { plugins: [i18n] }, attachTo: document.body });
	const input = wrapper.get('input[type="file"]').element as HTMLInputElement;
	const click = vi.spyOn(input, 'click').mockImplementation(() => {});

	(wrapper.get('.actions button').element as HTMLElement).focus();
	await userEvent.keyboard('{Enter}');

	expect(click).toHaveBeenCalledOnce();
});
