// Ported from directus/packages/composables/src/use-shortcut.test.ts; Ported from directus/packages/composables/src/translate-shortcut.test.ts
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, type Mock, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { translateShortcut, useShortcut } from './use-shortcut.ts';

function getTestComponent(shortcut: string, handler: () => void) {
	return defineComponent({
		setup() {
			useShortcut(shortcut, handler);
		},
		render: () => h('div'),
	});
}

describe('useShortcut', () => {
	let shortcutHandler: Mock;

	beforeEach(() => {
		shortcutHandler = vi.fn();
	});

	afterEach(() => {
		vi.clearAllMocks();
		document.body.innerHTML = '';
	});

	test.each(['Control', 'Command', 'Meta'])('should map "%s" key to "meta"', async (testKey) => {
		const keys = ['meta', 's'];
		const testComponent = getTestComponent(keys.join('+'), shortcutHandler);
		const wrapper = mount(testComponent, { attachTo: document.body });

		// intentionally not using keys[0] as we want to test Control/Command, not meta itself
		await wrapper.trigger('keydown', { key: testKey });
		await wrapper.trigger('keydown', { key: keys[1]! });
		await wrapper.trigger('keyup', { key: testKey });

		expect(shortcutHandler).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	test('should trigger with combination of shortcut keys', async () => {
		const keys = ['meta', 'alt', 'c'];
		const testComponent = getTestComponent(keys.join('+'), shortcutHandler);
		const wrapper = mount(testComponent, { attachTo: document.body });

		for (const key of keys) {
			await wrapper.trigger('keydown', { key });
		}

		await wrapper.trigger('keyup', { key: keys[0]! });

		expect(shortcutHandler).toHaveBeenCalledOnce();
		wrapper.unmount();
	});

	// Backoffice: scoping to a reference element and unmount cleanup have no DR test.
	test('only fires when focus is inside the reference element or on body, and stops after unmount', async () => {
		const Host = defineComponent({
			setup() {
				const form = ref<HTMLElement>();
				useShortcut('meta+s', shortcutHandler, form);
				return () =>
					h('div', [h('section', { ref: form }, [h('input', { id: 'inside' })]), h('input', { id: 'outside' })]);
			},
		});

		const wrapper = mount(Host, { attachTo: document.body });

		const press = async (target: HTMLElement) => {
			target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
			target.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true }));
			target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
		};

		const outside = document.getElementById('outside')!;
		outside.focus();
		await press(outside);
		expect(shortcutHandler).not.toHaveBeenCalled();

		const inside = document.getElementById('inside')!;
		inside.focus();
		await press(inside);
		expect(shortcutHandler).toHaveBeenCalledOnce();

		wrapper.unmount();
		document.body.focus();
		await press(document.body);
		expect(shortcutHandler).toHaveBeenCalledOnce();
	});
});

describe('translateShortcut', () => {
	const platform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');

	afterEach(() => {
		if (platform) Object.defineProperty(window.navigator, 'platform', platform);
		else delete (window.navigator as any).platform;
	});

	function setPlatform(value: string) {
		Object.defineProperty(window.navigator, 'platform', { value, configurable: true });
	}

	test('Windows/Linux', () => {
		setPlatform('test');
		expect(translateShortcut(['meta', 's'])).toBe('Ctrl+S');
		expect(translateShortcut(['option', 's'])).toBe('Option+S');
		expect(translateShortcut(['alt', 's'])).toBe('Alt+S');
		expect(translateShortcut(['shift', 's'])).toBe('Shift+S');
	});

	test('macOS/iOS', () => {
		setPlatform('MacIntel');

		expect(translateShortcut(['meta', 's'])).toBe('⌘S');
		expect(translateShortcut(['option', 's'])).toBe('⌥S');
		expect(translateShortcut(['alt', 's'])).toBe('⌥S');
		expect(translateShortcut(['shift', 's'])).toBe('⇧S');

		setPlatform('iPad');

		expect(translateShortcut(['meta', 's'])).toBe('⌘S');
		expect(translateShortcut(['option', 's'])).toBe('⌥S');
		expect(translateShortcut(['alt', 's'])).toBe('⌥S');
		expect(translateShortcut(['shift', 's'])).toBe('⇧S');
	});
});
