// Backoffice: Directus has no test for save-options.vue.
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '../lang/index.ts';
import SaveOptions from './SaveOptions.vue';

beforeEach(() => {
	Object.defineProperty(window.navigator, 'platform', { value: 'Win32', configurable: true });
});

afterEach(() => {
	delete (window.navigator as any).platform;
	document.body.innerHTML = '';
});

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

async function open(disabledOptions?: string[]) {
	const wrapper = mount(SaveOptions, {
		props: disabledOptions ? { disabledOptions } : {},
		global: { plugins: [i18n] },
		attachTo: document.body,
	});

	const trigger = wrapper.get('button').element;
	trigger.focus();
	await key(trigger, 'Enter');
	return { wrapper, trigger, items: [...document.body.querySelectorAll('[role="menuitem"]')] as HTMLElement[] };
}

describe('SaveOptions', () => {
	test('labelled menu trigger; the four options in Directus order with shortcut hints', async () => {
		const { wrapper, trigger, items } = await open();

		expect(trigger.getAttribute('aria-label')).toBe('More save options');
		expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		expect(items.map((item) => item.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
			'check Save and Stay Ctrl+S',
			'add Save and Create New Ctrl+Shift+S',
			'done_all Save as Copy',
			'undo Discard All Changes',
		]);
		wrapper.unmount();
	});

	test.each([
		[0, 'save-and-stay'],
		[1, 'save-and-add-new'],
		[2, 'save-as-copy'],
		[3, 'discard-and-stay'],
	])('item %i emits %s and closes the menu', async (index, event) => {
		const { wrapper, items } = await open();

		await key(items[index]!, 'Enter');

		expect(Object.keys(wrapper.emitted())).toContain(event);
		expect(wrapper.emitted(event)).toHaveLength(1);
		expect(document.body.querySelector('[role="menu"]')).toBeNull();
		wrapper.unmount();
	});

	test('disabledOptions hides those options', async () => {
		const { wrapper, items } = await open(['save-as-copy', 'save-and-add-new']);

		expect(items.map((item) => item.textContent)).toEqual([
			expect.stringContaining('Save and Stay'),
			expect.stringContaining('Discard All Changes'),
		]);
		wrapper.unmount();
	});

	test('Esc closes the menu and returns focus to the trigger', async () => {
		const { wrapper, trigger } = await open();

		await key(document.activeElement!, 'Escape');

		expect(document.body.querySelector('[role="menu"]')).toBeNull();
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
		wrapper.unmount();
	});
});
