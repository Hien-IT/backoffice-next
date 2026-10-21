import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { h, nextTick } from 'vue';
import VMenu from './VMenu.vue';

enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

type SlotProps = { toggle: () => void; active: boolean; activate: () => void; deactivate: () => void };

const content = () => document.body.querySelector<HTMLElement>('.v-menu-content');
const popper = () => document.body.querySelector<HTMLElement>('.v-menu-popper');

function mountMenu(props: Record<string, unknown> = {}) {
	return mount(VMenu, {
		props,
		slots: {
			activator: ({ toggle, active }: SlotProps) =>
				h('button', { type: 'button', class: 'opener', onClick: toggle }, active ? 'Close' : 'Open'),
			default: ({ deactivate }: SlotProps) =>
				h('ul', [
					h('li', [h('button', { type: 'button', class: 'item' }, 'Edit')]),
					h('li', [h('button', { type: 'button', class: 'other', onClick: deactivate }, 'Other')]),
				]),
		},
		attachTo: document.body,
	});
}

describe('VMenu', () => {
	test('the activator slot toggles the menu; it is teleported, has the exposed id and the recipe', async () => {
		const wrapper = mountMenu();
		expect(content()).toBeNull();

		await wrapper.get('button.opener').trigger('click');
		await flushPromises();

		expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
		expect(wrapper.get('button.opener').text()).toBe('Close');
		expect(content()!.id).toBe((wrapper.vm as unknown as { id: string }).id);
		expect(content()!.className).toEqual(expect.stringContaining('p-2'));
		expect(content()!.className).toContain('max-h-[30vh]');
		expect(popper()!.className).toEqual(expect.stringContaining('rounded-xl border border-gray-200 bg-white'));
		expect(wrapper.element.contains(content())).toBe(false);
	});

	test('a click in the content closes it (closeOnContentClick), a click on the content box itself does not', async () => {
		const wrapper = mountMenu({
			modelValue: true,
			'onUpdate:modelValue': (v: boolean) => wrapper.setProps({ modelValue: v }),
		});
		await flushPromises();

		content()!.click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		content()!.querySelector<HTMLElement>('button.item')!.click();
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
		expect(content()).toBeNull();

		const keep = mountMenu({ modelValue: true, closeOnContentClick: false });
		await flushPromises();
		content()!.querySelector<HTMLElement>('button.item')!.click();
		await flushPromises();
		expect(keep.emitted('update:modelValue')).toBeUndefined();
	});

	test('expose: activate(event) opens at the pointer (context menu), deactivate closes', async () => {
		const wrapper = mount(VMenu, { slots: { default: () => 'Copy' }, attachTo: document.body });
		const vm = wrapper.vm as unknown as {
			activate: (e?: MouseEvent) => void;
			deactivate: () => void;
			activator: HTMLElement;
		};

		expect(vm.activator).toBeInstanceOf(HTMLElement);
		vm.activate(new MouseEvent('contextmenu', { clientX: 30, clientY: 40 }));
		await flushPromises();
		expect(content()!.textContent).toBe('Copy');

		vm.deactivate();
		await flushPromises();
		expect(content()).toBeNull();
	});

	test('disabled: toggle does nothing', async () => {
		const wrapper = mountMenu({ disabled: true });

		await wrapper.get('button.opener').trigger('click');
		await flushPromises();
		expect(content()).toBeNull();
	});

	test('an outside pointer down closes it, not on the activator nor with closeOnClick false', async () => {
		const wrapper = mountMenu({
			modelValue: true,
			'onUpdate:modelValue': (v: boolean) => wrapper.setProps({ modelValue: v }),
		});
		// Reka adds its outside listener in a timeout after opening.
		await new Promise((resolve) => setTimeout(resolve, 50));

		wrapper.get('button.opener').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await flushPromises();
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
		wrapper.unmount();

		const keep = mountMenu({ modelValue: true, closeOnClick: false });
		await new Promise((resolve) => setTimeout(resolve, 50));
		document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
		await flushPromises();
		expect(keep.emitted('update:modelValue')).toBeUndefined();
	});

	test('Tab from the activator moves into the menu; Esc closes and the focus returns to the activator', async () => {
		const wrapper = mountMenu();
		const opener = wrapper.get('button.opener').element as HTMLElement;

		opener.focus();
		opener.click();
		await flushPromises();
		expect(document.activeElement).toBe(opener);

		opener.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
		expect(document.activeElement).toBe(content()!.querySelector('button.item'));

		document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(content()).toBeNull();
		expect(document.activeElement).toBe(opener);
	});

	test('trigger click on the wrapper; hover after the delay', async () => {
		const clicked = mount(VMenu, {
			props: { trigger: 'click' },
			slots: { activator: () => h('button', { type: 'button', class: 'opener' }, 'Open'), default: () => 'Menu' },
			attachTo: document.body,
		});
		await clicked.get('button.opener').trigger('click');
		await flushPromises();
		expect(content()!.textContent).toBe('Menu');
		clicked.unmount();

		vi.useFakeTimers();
		const hovered = mount(VMenu, {
			props: { trigger: 'hover', delay: 100 },
			slots: { activator: () => h('button', { type: 'button', class: 'opener' }, 'Open'), default: () => 'Menu' },
			attachTo: document.body,
		});
		await hovered.get('.v-menu-activator').trigger('pointerenter');
		vi.advanceTimersByTime(99);
		await nextTick();
		expect(hovered.emitted('update:modelValue')).toBeUndefined();
		vi.advanceTimersByTime(1);
		await nextTick();
		expect(hovered.emitted('update:modelValue')).toEqual([[true]]);

		await hovered.get('.v-menu-activator').trigger('pointerleave');
		vi.advanceTimersByTime(100);
		await nextTick();
		expect(hovered.emitted('update:modelValue')).toEqual([[true], [false]]);
	});

	test('attached, keepBehind, seamless, fullHeight and invert', async () => {
		mountMenu({ modelValue: true, attached: true, keepBehind: true, seamless: true, fullHeight: true, invert: true });
		await flushPromises();

		expect(popper()!.className).toContain('min-w-(--reka-popper-anchor-width)');
		expect(popper()!.className).toContain('z-9999!');
		expect(content()!.className).toContain('p-0');
		expect(content()!.className).not.toContain('max-h-[30vh]');
		expect(content()!.className).toContain('bg-gray-900');
	});
});
