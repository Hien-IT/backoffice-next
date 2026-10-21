// Spec 020 (T114, data-model §7 row 46): VResizeable sets the width of its first child; the grab bar is a focusable
// separator that also resizes with the keyboard (design-system XII).
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import { i18n } from '../../lang/index.ts';
import VResizeable from './VResizeable.vue';

// happy-dom has no layout, so the target never intersects: the bar shows as for a visible pane.
vi.mock('@vueuse/core', async (original) => ({
	...(await original<typeof import('@vueuse/core')>()),
	useElementVisibility: () => ref(true),
}));

enableAutoUnmount(afterEach);
beforeEach(() => setActivePinia(createPinia()));

function setup(props: Record<string, unknown> = {}) {
	const wrapper = mount(VResizeable, {
		props: { width: 300, minWidth: 200, maxWidth: 400, ...props },
		slots: { default: '<aside class="pane">Pane</aside>' },
		global: { plugins: [i18n] },
		attachTo: document.body,
	});
	wrapper.setProps({ 'onUpdate:width': (width: number) => wrapper.setProps({ width }) });
	return wrapper;
}

test('the first child gets the width, capped at maxWidth', async () => {
	const wrapper = setup();
	await nextTick();
	expect((wrapper.get('.pane').element as HTMLElement).style.inlineSize).toBe('300px');

	await wrapper.setProps({ width: 500 });
	expect((wrapper.get('.pane').element as HTMLElement).style.inlineSize).toBe('400px');
});

test('the separator resizes with the arrows (Shift for larger steps), Home, End and Enter, within the bounds', async () => {
	const wrapper = setup({ defaultWidth: 250 });
	await nextTick();
	const bar = wrapper.get('[role="separator"]');
	const widths = () => wrapper.emitted<[number]>('update:width')!.map(([width]) => width);

	expect(bar.attributes()).toMatchObject({ tabindex: '0', 'aria-valuenow': '300', 'aria-valuemin': '200' });

	await bar.trigger('keydown', { key: 'ArrowRight' });
	await bar.trigger('keydown', { key: 'ArrowLeft', shiftKey: true });
	await bar.trigger('keydown', { key: 'End' });
	await bar.trigger('keydown', { key: 'ArrowRight' });
	await bar.trigger('keydown', { key: 'Home' });
	await bar.trigger('keydown', { key: 'Enter' });

	expect(widths()).toEqual([310, 260, 400, 400, 200, 250]);
});

test('disabled renders the slot only', () => {
	const wrapper = setup({ disabled: true });

	expect(wrapper.find('[role="separator"]').exists()).toBe(false);
	expect((wrapper.get('.pane').element as HTMLElement).style.inlineSize).toBe('');
});
