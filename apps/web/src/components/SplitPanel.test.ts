import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';
import SplitPanel from './SplitPanel.vue';

function mountPanel(props: Record<string, unknown> = {}) {
	const wrapper = mount(SplitPanel, {
		attachTo: document.body,
		props: {
			size: 50,
			minSize: 20,
			maxSize: 80,
			label: 'Live preview',
			'onUpdate:size': (size: number) => wrapper.setProps({ size }),
			...props,
		},
		slots: { start: '<form data-start />', end: '<section data-end />' },
	});

	return wrapper;
}

test('start and end slots around a labelled separator with the real bounds', () => {
	const wrapper = mountPanel();
	const divider = wrapper.get('[role="separator"]');

	expect(wrapper.find('.sp-start [data-start]').exists()).toBe(true);
	expect(wrapper.find('.sp-end [data-end]').exists()).toBe(true);
	expect(divider.attributes()).toMatchObject({
		tabindex: '0',
		'aria-label': 'Live preview',
		'aria-orientation': 'vertical',
		'aria-valuenow': '50',
		'aria-valuemin': '20',
		'aria-valuemax': '80',
	});
	expect(divider.find('.cursor-col-resize').classes()).toContain('motion-reduce:transition-none');
	wrapper.unmount();
});

test('arrows move the divider by 5 %, Home/End go to min/max (D-69)', async () => {
	const wrapper = mountPanel();
	const divider = wrapper.get('[role="separator"]');

	await divider.trigger('keydown', { key: 'ArrowLeft' });
	expect(wrapper.props('size')).toBe(55);
	expect(divider.attributes('aria-valuenow')).toBe('55');

	await divider.trigger('keydown', { key: 'ArrowRight' });
	await divider.trigger('keydown', { key: 'ArrowRight' });
	expect(wrapper.props('size')).toBe(45);

	await divider.trigger('keydown', { key: 'Home' });
	expect(wrapper.props('size')).toBe(20);
	await divider.trigger('keydown', { key: 'ArrowRight' });
	expect(wrapper.props('size')).toBe(20);

	await divider.trigger('keydown', { key: 'End' });
	expect(wrapper.props('size')).toBe(80);
	expect(wrapper.emitted('update:size')).toEqual([[55], [50], [45], [20], [80]]);
	wrapper.unmount();
});

test('bounds follow the props', async () => {
	const wrapper = mountPanel();

	await wrapper.setProps({ minSize: 0, maxSize: 100, label: 'Preview' });

	expect(wrapper.get('[role="separator"]').attributes()).toMatchObject({
		'aria-valuemin': '0',
		'aria-valuemax': '100',
		'aria-label': 'Preview',
	});
	wrapper.unmount();
});

test('disabled: not focusable, keys do nothing', async () => {
	const wrapper = mountPanel({ disabled: true });
	const divider = wrapper.get('[role="separator"]');

	expect(divider.attributes('tabindex')).toBeUndefined();
	await divider.trigger('keydown', { key: 'ArrowLeft' });
	await divider.trigger('keydown', { key: 'End' });
	expect(wrapper.emitted('update:size')).toBeUndefined();
	wrapper.unmount();
});

test('Enter collapses through the package, the divider hides when collapsed', async () => {
	const wrapper = mountPanel({ 'onUpdate:collapsed': (collapsed: boolean) => wrapper.setProps({ collapsed }) });

	await wrapper.get('[role="separator"]').trigger('keydown', { key: 'Enter' });

	expect(wrapper.emitted('update:collapsed')).toEqual([[true]]);
	expect(wrapper.classes()).toContain('sp-collapsed');
	expect(wrapper.get('[role="separator"]').classes()).toContain('[.sp-collapsed>&]:hidden');
	wrapper.unmount();
});
