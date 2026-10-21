import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import { h } from 'vue';
import { i18n } from '../../lang/index.ts';
import VCard from './VCard.vue';
import VCardActions from './VCardActions.vue';
import VCardSubtitle from './VCardSubtitle.vue';
import VCardText from './VCardText.vue';
import VCardTitle from './VCardTitle.vue';
import VDetail from './VDetail.vue';
import VDivider from './VDivider.vue';
import VSheet from './VSheet.vue';

describe('VCard', () => {
	test('card parts render their slot; the title has .type-label', () => {
		const wrapper = mount(VCard, {
			slots: {
				default: () => [
					h(VCardTitle, () => 'Title'),
					h(VCardSubtitle, () => 'Subtitle'),
					h(VCardText, () => 'Text'),
					h(VCardActions, () => h('button', 'OK')),
				],
			},
		});

		expect(wrapper.get('.v-card-title').classes()).toContain('type-label');
		expect(wrapper.text()).toBe('TitleSubtitleTextOK');
		expect(wrapper.classes()).toContain('rounded-2xl');
	});

	test('disabled blocks interaction, tile drops the radius', () => {
		const wrapper = mount(VCard, { props: { disabled: true, tile: true } });
		expect(wrapper.classes()).toEqual(expect.arrayContaining(['pointer-events-none', 'rounded-none']));
		expect(wrapper.classes()).not.toContain('rounded-2xl');
	});

	test('VSheet renders its slot', () => {
		expect(mount(VSheet, { slots: { default: 'Sheet' } }).text()).toBe('Sheet');
	});
});

describe('VDivider', () => {
	test('default slot in .type-text, icon slot, large, inline title', () => {
		const wrapper = mount(VDivider, {
			props: { large: true },
			slots: { default: 'Section', icon: '<i data-icon>star</i>' },
		});

		expect(wrapper.get('h3 .type-text').text()).toBe('Section');
		expect(wrapper.get('h3').classes()).toContain('text-xl');
		expect(wrapper.find('[data-icon]').exists()).toBe(true);
		expect(wrapper.classes()).toContain('flex');
	});

	test('vertical and title below', () => {
		expect(mount(VDivider, { props: { vertical: true } }).attributes('data-orientation')).toBe('vertical');
		expect(mount(VDivider, { props: { inlineTitle: false }, slots: { default: 'S' } }).classes()).not.toContain('flex');
	});
});

describe('VDetail', () => {
	const global = { plugins: [i18n] };

	test('local state from startOpen, label (default Toggle), update:modelValue', async () => {
		const wrapper = mount(VDetail, { props: { startOpen: true }, slots: { default: '<p data-body>Body</p>' }, global });
		expect(wrapper.get('button').text()).toContain('Toggle');
		expect(wrapper.find('[data-body]').exists()).toBe(true);

		await wrapper.get('button').trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
		expect(wrapper.find('[data-body]').exists()).toBe(false);

		expect(
			mount(VDetail, { props: { label: 'More' }, global })
				.get('button')
				.text(),
		).toContain('More');
	});

	test('a model value wins over the local state; the title slot replaces the label', () => {
		const wrapper = mount(VDetail, {
			props: { modelValue: true, startOpen: false },
			slots: { default: '<p data-body>Body</p>', title: '<b>Custom</b>' },
			global,
		});
		expect(wrapper.find('[data-body]').exists()).toBe(true);
		expect(wrapper.get('button b').text()).toBe('Custom');
	});

	test('the activator slot replaces the button with { active, enable, disable, toggle }', async () => {
		const wrapper = mount(VDetail, {
			slots: {
				activator: `<template #activator="{ active, toggle, enable, disable }">
					<span data-active>{{ active }}</span>
					<button data-toggle @click="toggle">t</button>
					<button data-enable @click="enable">e</button>
					<button data-disable @click="disable">d</button>
				</template>`,
				default: '<p data-body>Body</p>',
			},
			global,
		});

		expect(wrapper.get('[data-active]').text()).toBe('false');
		await wrapper.get('[data-toggle]').trigger('click');
		expect(wrapper.get('[data-active]').text()).toBe('true');
		expect(wrapper.find('[data-body]').exists()).toBe(true);
		await wrapper.get('[data-disable]').trigger('click');
		await wrapper.get('[data-enable]').trigger('click');
		expect(wrapper.emitted('update:modelValue')).toEqual([[true], [false], [true]]);
	});
});
