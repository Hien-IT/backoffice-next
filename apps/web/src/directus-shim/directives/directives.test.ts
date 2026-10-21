// Spec 020 (T106): the directives of directus/app/src/directives registered for extensions, mounted on small templates.
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { registerDirectives } from './index.ts';

const app = createApp({});
registerDirectives(app);
const directives = app._context.directives;
const global = { directives };

beforeEach(() => {
	setActivePinia(createPinia());
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

test('the seven names of Directus', () => {
	expect(Object.keys(directives).sort()).toEqual([
		'click-outside',
		'context-menu',
		'focus',
		'input-auto-width',
		'md',
		'prevent-focusout',
		'tooltip',
	]);
});

test('v-click-outside: a pointerdown outside calls the handler, inside does not', async () => {
	const handler = vi.fn();
	const wrapper = mount(
		{ template: '<div><p v-click-outside="handler">in</p></div>', setup: () => ({ handler }) },
		{
			global,
			attachTo: document.body,
		},
	);

	vi.runAllTimers();
	wrapper.get('p').element.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
	expect(handler).not.toHaveBeenCalled();
	document.body.dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
	expect(handler).toHaveBeenCalledOnce();
	wrapper.unmount();
});

test('v-focus focuses the element; v-md renders sanitized markdown', () => {
	const wrapper = mount(
		{
			template: '<div><input v-focus="true" /><div class="md" v-md="text" /></div>',
			setup: () => ({ text: '**b** <script>x</script>' }),
		},
		{ global, attachTo: document.body },
	);

	expect(document.activeElement).toBe(wrapper.get('input').element);
	expect(wrapper.get('.md').html()).toContain('<strong>b</strong>');
	expect(wrapper.get('.md').html()).not.toContain('script');
	wrapper.unmount();
});

test('v-prevent-focusout stops focusout while on', async () => {
	const on = ref(true);
	const wrapper = mount(
		{ template: '<div v-prevent-focusout="on"><input /></div>', setup: () => ({ on }) },
		{
			global,
			attachTo: document.body,
		},
	);

	const event = new FocusEvent('focusout', { bubbles: true, cancelable: true });
	wrapper.element.dispatchEvent(event);
	expect(event.defaultPrevented).toBe(true);

	on.value = false;
	await nextTick();
	const later = new FocusEvent('focusout', { bubbles: true, cancelable: true });
	wrapper.element.dispatchEvent(later);
	expect(later.defaultPrevented).toBe(false);
	wrapper.unmount();
});

test('v-input-auto-width adds a hidden measuring element and removes it on unmount', () => {
	const wrapper = mount({ template: '<input v-input-auto-width value="abc" />' }, { global, attachTo: document.body });

	expect(document.body.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
	wrapper.unmount();
	expect(document.body.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
});

test('v-context-menu opens the referenced menu on contextmenu', () => {
	const activate = vi.fn();
	const Menu = defineComponent({
		setup: (_, { expose }) => (expose({ activate, deactivate: vi.fn(), id: 'm' }), () => h('span')),
	});
	const wrapper = mount(
		{ components: { Menu }, template: '<div><p v-context-menu="\'menu\'">x</p><Menu ref="menu" /></div>' },
		{ global, attachTo: document.body },
	);

	wrapper.get('p').element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
	expect(activate).toHaveBeenCalledOnce();
	wrapper.unmount();
});

test('v-tooltip shows the one #tooltip after the delay, with the text', () => {
	const wrapper = mount({ template: '<button v-tooltip="\'Hello\'">b</button>' }, { global, attachTo: document.body });

	wrapper.get('button').element.dispatchEvent(new MouseEvent('mouseenter'));
	vi.advanceTimersByTime(500);

	const tooltip = document.getElementById('tooltip')!;
	expect(tooltip.innerText ?? tooltip.textContent).toBe('Hello');
	expect(tooltip.classList.contains('visible')).toBe(true);
	wrapper.unmount();
});
