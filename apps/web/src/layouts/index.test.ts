import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { getInternalLayouts, getLayout, registerLayouts } from './index.ts';
import type { LayoutConfig } from './types.ts';

const Broken = defineComponent({
	setup() {
		throw new Error('boom');
	},
});

const Echo = defineComponent({
	props: { collection: String },
	emits: ['update:selection'],
	setup:
		(props, { emit, slots }) =>
		() =>
			h('button', { onClick: () => emit('update:selection', [1]) }, [props.collection, slots['default']?.()]),
});

describe('registerLayouts (spec 020, FR-064, FR-067)', () => {
	test('internal layouts are kept as is; extension layouts are guarded and pass props, events and slots', async () => {
		const ext = {
			id: 'ext',
			name: 'Ext',
			icon: 'box',
			component: Echo,
			slots: { options: Broken, sidebar: Echo, actions: Echo },
			setup: () => ({}),
		};
		registerLayouts([...getInternalLayouts(), ext as unknown as LayoutConfig]);

		expect(getLayout('tabular')).toBe(getInternalLayouts().find((l) => l.id === 'tabular'));

		const onUpdate = vi.fn();
		const wrapper = mount(getLayout('ext')!.component, {
			props: { collection: 'articles', 'onUpdate:selection': onUpdate },
			slots: { default: () => 'inner' },
		});
		expect(wrapper.text()).toBe('articlesinner');
		await wrapper.find('button').trigger('click');
		expect(onUpdate).toHaveBeenCalledWith([1]);

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const broken = mount(getLayout('ext')!.slots.options);
		await nextTick();
		expect(broken.text()).toContain('Unexpected Error');
		warn.mockRestore();

		registerLayouts(getInternalLayouts());
		expect(getLayout('ext')).toBeUndefined();
	});
});
