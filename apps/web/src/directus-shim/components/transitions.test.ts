import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import ExpandMethods from './expand-methods.ts';
import TransitionBounce from './TransitionBounce.vue';
import TransitionDialog from './TransitionDialog.vue';
import TransitionExpand from './TransitionExpand.vue';

afterEach(() => vi.unstubAllGlobals());

const global = { stubs: { transition: false, 'transition-group': false } };

describe('transitions', () => {
	test('TransitionBounce is a `bounce` transition group with the attributes; TransitionDialog a `dialog` transition', () => {
		const bounce = mount(TransitionBounce, {
			attrs: { class: 'list' },
			slots: { default: () => h('p', { key: 1 }, 'A') },
			global,
		});
		expect(bounce.element.tagName).toBe('DIV');
		expect(bounce.classes()).toContain('list');
		expect(bounce.text()).toBe('A');

		const dialog = mount(TransitionDialog, { slots: { default: () => h('p', 'B') }, global });
		expect(dialog.text()).toBe('B');
	});

	test('TransitionExpand renders the slot and emits the hooks', async () => {
		const Host = defineComponent({
			props: { show: Boolean },
			emits: ['beforeEnter', 'leave'],
			setup:
				(props, { emit }) =>
				() =>
					h(TransitionExpand, { onBeforeEnter: () => emit('beforeEnter'), onLeave: () => emit('leave') }, () =>
						props.show ? h('p', 'C') : null,
					),
		});
		const wrapper = mount(Host, { global });

		await wrapper.setProps({ show: true });
		expect(wrapper.text()).toBe('C');
		expect(wrapper.emitted('beforeEnter')).toHaveLength(1);

		await wrapper.setProps({ show: false });
		expect(wrapper.emitted('leave')).toHaveLength(1);
	});

	test('expand methods: animate the height from 0 and restore the inline styles; the parent class', () => {
		vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback());
		const emit = vi.fn();
		const methods = ExpandMethods('open', false, emit);
		const parent = document.createElement('div');
		const el = document.createElement('div');
		parent.append(el);
		Object.defineProperty(el, 'offsetHeight', { value: 120 });

		methods['beforeEnter'](el);
		methods['enter'](el);
		expect(el.style.blockSize).toBe('120px');
		expect(el.style.overflow).toBe('hidden');
		expect(el.style.transition).toContain('block-size');
		expect(parent.classList.contains('open')).toBe(true);

		methods['afterEnter'](el);
		expect(el.style.blockSize).toBe('');
		expect(el.style.overflow).toBe('');

		methods['beforeLeave'](el);
		methods['leave'](el);
		expect(el.style.blockSize).toMatch(/^0(px)?$/);
		methods['afterLeave'](el);
		expect(parent.classList.contains('open')).toBe(false);

		expect(emit.mock.calls.map(([event]) => event)).toEqual([
			'beforeEnter',
			'enter',
			'afterEnter',
			'beforeLeave',
			'leave',
			'afterLeave',
		]);
	});

	test('expand methods: no size animation under prefers-reduced-motion; xAxis uses the width', () => {
		vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
		const methods = ExpandMethods('', true, vi.fn());
		const el = document.createElement('div');

		methods['beforeEnter'](el);
		methods['enter'](el);
		expect(el.style.inlineSize).toBe('');
		expect(el.style.overflow).toBe('');
	});
});
