// DR has no test for bookmark-add.vue: activator, name required, save payload, cancel reset.
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { h } from 'vue';
import { i18n } from '../../../lang/index.ts';
import { useUserStore } from '../../../stores/user.ts';
import BookmarkAdd from './BookmarkAdd.vue';

vi.mock('../../../utils/fetch-all.ts', () => ({ fetchAll: vi.fn(async () => []) }));

enableAutoUnmount(afterEach);

beforeEach(() => {
	setActivePinia(createPinia());
	useUserStore().currentUser = { id: 'me', language: 'en-US' } as never;
});

async function setup(props: Record<string, unknown> = {}) {
	const wrapper: VueWrapper = mount(BookmarkAdd, {
		props: { ...props, 'onUpdate:modelValue': (modelValue: boolean) => wrapper.setProps({ modelValue }) },
		slots: { activator: ({ on }: { on: () => void }) => h('button', { type: 'button', onClick: on }, 'Add') },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	await flushPromises();
	return wrapper;
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const button = (text: string) =>
	[...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((el) => el.textContent?.trim() === text)!;

describe('BookmarkAdd', () => {
	test('the activator opens the create dialog; Save needs a name and emits name, icon and color', async () => {
		const wrapper = await setup();
		expect(dialog()).toBeNull();

		await wrapper.get('button').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
		expect(dialog()!.textContent).toContain('Create Bookmark');

		const name = dialog()!.querySelector<HTMLInputElement>('input[placeholder="Bookmark name..."]')!;
		expect(dialog()!.contains(document.activeElement)).toBe(true);
		expect(button('Save').disabled).toBe(true);

		name.value = 'My view';
		name.dispatchEvent(new Event('input'));
		await flushPromises();
		expect(button('Save').disabled).toBe(false);

		// Enter in the form applies (DR @apply).
		dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
		expect(wrapper.emitted('save')).toEqual([[{ name: 'My view', icon: 'bookmark', color: null }]]);
	});

	test('no save while saving; Cancel resets the values and closes', async () => {
		const wrapper = await setup({ modelValue: true, saving: true });

		const name = dialog()!.querySelector<HTMLInputElement>('input[placeholder="Bookmark name..."]')!;
		name.value = 'My view';
		name.dispatchEvent(new Event('input'));
		await flushPromises();
		dialog()!.querySelector('form')!.dispatchEvent(new Event('submit'));
		expect(wrapper.emitted('save')).toBeUndefined();

		button('Cancel').click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);

		await wrapper.setProps({ modelValue: true, saving: false });
		await flushPromises();
		expect(dialog()!.querySelector<HTMLInputElement>('input[placeholder="Bookmark name..."]')!.value).toBe('');
	});
});
