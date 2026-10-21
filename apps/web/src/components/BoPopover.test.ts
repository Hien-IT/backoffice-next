import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test } from 'vitest';
import { h } from 'vue';
import BoPopover from './BoPopover.vue';

enableAutoUnmount(afterEach);

const panel = () => document.body.querySelector<HTMLElement>('.bo-popover');

function mountPopover(props: Record<string, unknown> = {}) {
	return mount(BoPopover, {
		props,
		slots: {
			activator: () => h('button', { type: 'button', class: 'opener' }, 'Open'),
			default: ({ close }: { close: () => void }) => [
				h('p', 'Body'),
				h('button', { type: 'button', class: 'inner', onClick: close }, 'Done'),
			],
		},
		attachTo: document.body,
	});
}

describe('BoPopover', () => {
	test('the activator opens the panel in body with the recipe classes; the slot close() closes it', async () => {
		const wrapper = mountPopover();
		const opener = wrapper.get('button.opener');

		expect(panel()).toBeNull();
		expect(opener.attributes('aria-expanded')).toBe('false');

		await opener.trigger('click');
		await flushPromises();

		expect(wrapper.emitted('update:open')).toEqual([[true]]);
		expect(opener.attributes('aria-expanded')).toBe('true');
		expect(panel()!.textContent).toContain('Body');
		expect(panel()!.className).toEqual(expect.stringContaining('rounded-xl border border-gray-200 bg-white'));
		expect(panel()!.dataset['side']).toBe('bottom');
		expect(panel()!.querySelector('div')!.className).toContain('p-2');
		expect(wrapper.element.contains(panel())).toBe(false);

		panel()!.querySelector<HTMLElement>('button.inner')!.click();
		await flushPromises();
		expect(wrapper.emitted('update:open')!.at(-1)).toEqual([false]);
	});

	test('Esc closes and the focus returns to the activator', async () => {
		const wrapper = mountPopover({ open: true, 'onUpdate:open': (open: boolean) => wrapper.setProps({ open }) });
		await flushPromises();

		panel()!.querySelector<HTMLElement>('button.inner')!.focus();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await flushPromises();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(wrapper.emitted('update:open')).toEqual([[false]]);
		expect(panel()).toBeNull();
		expect(document.activeElement).toBe(wrapper.get('button.opener').element);
	});

	test('without an activator it sits against `reference`; seamless, arrow and attributes', async () => {
		const reference = { getBoundingClientRect: () => new DOMRect(40, 40, 0, 0) };
		mount(BoPopover, {
			props: {
				open: true,
				'onUpdate:open': () => {},
				reference,
				side: 'right',
				align: 'start',
				seamless: true,
				arrow: true,
			},
			attrs: { 'data-menu': '1', class: 'min-w-22.5' },
			slots: { default: () => 'Item' },
			attachTo: document.body,
		});
		await flushPromises();

		expect(panel()!.dataset['menu']).toBe('1');
		expect(panel()!.className).toContain('min-w-22.5');
		expect(panel()!.querySelector('div')!.className).not.toContain('p-2');
		expect(panel()!.querySelector('svg')).not.toBeNull();
	});
});
