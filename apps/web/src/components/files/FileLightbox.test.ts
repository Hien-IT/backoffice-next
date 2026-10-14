import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { h } from 'vue';
import { createSdk } from '../../api/sdk.ts';
import { i18n } from '../../lang/index.ts';
import FileLightbox from './FileLightbox.vue';

enableAutoUnmount(afterEach);

beforeEach(() => {
	createSdk('https://api.test/');
});

const file = {
	id: 'img',
	title: 'Cat',
	type: 'image/jpeg',
	modified_on: null as unknown as string,
	width: 800,
	height: 600,
} as const;

async function mountLightbox(props: Record<string, unknown> = {}) {
	const wrapper = mount(FileLightbox, {
		props: { file, modelValue: true, ...props },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

test('shows the title, the original image, a download link and a labelled close button', async () => {
	await mountLightbox();

	const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
	expect(dialog.querySelector('h2')!.textContent?.trim()).toBe('Cat');
	expect(dialog.querySelector('img')!.getAttribute('src')).toBe('https://api.test/assets/img');
	expect(dialog.querySelector('a[download]')!.getAttribute('href')).toBe('https://api.test/assets/img?download=');
	expect(dialog.querySelector('a[download]')!.getAttribute('aria-label')).toBe('Download');
	expect(dialog.querySelector('button[aria-label="Close"]')).not.toBeNull();
});

test('the close button, a click on the media and Esc close it', async () => {
	const wrapper = await mountLightbox();

	document.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
	await flushPromises();
	document.querySelector<HTMLElement>('[role="dialog"] img')!.click();
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	await flushPromises();

	expect(wrapper.emitted('update:modelValue')).toEqual([[false], [false], [false]]);
});

test('the activator slot opens it', async () => {
	const wrapper = mount(FileLightbox, {
		props: { file, modelValue: false },
		slots: { activator: ({ on }: { on: () => void }) => h('button', { class: 'open', onClick: on }, 'Open') },
		global: { plugins: [i18n] },
	});

	await wrapper.get('button.open').trigger('click');
	expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
});
