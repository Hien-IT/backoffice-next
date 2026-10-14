import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import BoMenu, { type BoMenuItem } from './BoMenu.vue';

afterEach(() => {
	document.body.innerHTML = '';
});

async function key(el: Element, key: string) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
	await flushPromises();
}

function menu() {
	return document.body.querySelector('[role="menu"]');
}

async function mountMenu(items: BoMenuItem[]) {
	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/:p(.*)*', component: { render: () => null } }],
	});
	await router.push('/');

	const Host = defineComponent(
		() => () =>
			h(BoMenu, { items }, { trigger: () => h('button', { type: 'button', 'aria-label': 'User menu' }, 'open') }),
	);

	const wrapper = mount(Host, { attachTo: document.body, global: { plugins: [router] } });
	return { wrapper, router, trigger: wrapper.get('button').element };
}

describe('BoMenu', () => {
	test('opens with the keyboard, Esc closes and focus returns to the trigger', async () => {
		const { wrapper, trigger } = await mountMenu([{ text: 'Sign Out', icon: 'logout', onSelect: () => {} }]);

		trigger.focus();
		await key(trigger, 'Enter');
		expect(menu()).not.toBeNull();
		expect(trigger.getAttribute('aria-expanded')).toBe('true');

		await key(document.activeElement!, 'Escape');
		expect(menu()).toBeNull();
		// Reka's FocusScope returns focus in a setTimeout after the content unmounts.
		await vi.waitFor(() => expect(document.activeElement).toBe(trigger));
		wrapper.unmount();
	});

	test('Enter on an item runs onSelect; a `to` item is a link', async () => {
		const onSelect = vi.fn();
		const { wrapper, trigger } = await mountMenu([
			{ text: 'Profile', to: '/users/me' },
			{ text: 'Sign Out', onSelect },
		]);

		trigger.focus();
		await key(trigger, 'Enter');

		const items = document.body.querySelectorAll('[role="menuitem"]');
		expect(items[0]!.tagName).toBe('A');
		expect(items[0]!.getAttribute('href')).toBe('/users/me');

		await key(items[1]!, 'Enter');
		expect(onSelect).toHaveBeenCalledOnce();
		expect(menu()).toBeNull();
		wrapper.unmount();
	});

	test('an href item opens in a new tab; disabled and loading items', async () => {
		const onSelect = vi.fn();
		const { wrapper, trigger } = await mountMenu([
			{ text: 'Docs', href: 'https://example.com' },
			{ text: 'Off', disabled: true, onSelect },
			{ text: 'Running', loading: true },
		]);

		trigger.focus();
		await key(trigger, 'Enter');

		const items = document.body.querySelectorAll('[role="menuitem"]');
		expect(items[0]!.tagName).toBe('A');
		expect(items[0]!.getAttribute('href')).toBe('https://example.com');
		expect(items[0]!.getAttribute('target')).toBe('_blank');
		expect(items[0]!.getAttribute('rel')).toBe('noopener noreferrer');
		expect(items[1]!.getAttribute('aria-disabled')).toBe('true');
		(items[1] as HTMLElement).click();
		expect(onSelect).not.toHaveBeenCalled();
		expect(items[2]!.querySelector('[role="progressbar"]')).not.toBeNull();
		expect(items[2]!.querySelector('.sr-only')!.textContent).toBe('Running');
		wrapper.unmount();
	});
});
