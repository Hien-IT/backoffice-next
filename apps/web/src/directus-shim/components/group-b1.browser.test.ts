// Spec 020 (T111): keyboard and axe (light and dark) on the input shims VInput, VTextarea, VCheckbox, VCheckboxTree,
// VSlider, VRemove and VRadio, as an extension form would use them.
import { userEvent } from '@vitest/browser/context';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import axe from 'axe-core';
import { afterEach, expect, test } from 'vitest';
import { h, ref, type Component } from 'vue';
import { i18n } from '../../lang/index.ts';
import '../../styles/index.css';
import '../styles/theme-vars.css';
import VCheckbox from './VCheckbox.vue';
import VCheckboxTree from './VCheckboxTree.vue';
import VInput from './VInput.vue';
import VRadio from './VRadio.vue';
import VRemove from './VRemove.vue';
import VSlider from './VSlider.vue';
import VTextarea from './VTextarea.vue';

enableAutoUnmount(afterEach);

async function serious(el: Element) {
	const { violations } = await axe.run(el, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] });
	return violations
		.filter((v) => v.impact === 'serious' || v.impact === 'critical')
		.map((v) => `${v.id} ${v.nodes.map((n) => n.html + n.failureSummary).join('|')}`);
}

const state = {
	name: ref<string | null>('a'),
	amount: ref<number | null>(2),
	notes: ref<string | null>(''),
	agree: ref<boolean | null>(false),
	tags: ref<string[]>(['x']),
	other: ref<string | null>('custom'),
	size: ref<string | number | null>('s'),
	level: ref<number | null>(5),
	tree: ref<(string | number)[]>(['apple']),
	removed: ref(0),
};

const model = <T>(value: { value: T }) => ({
	modelValue: value.value,
	'onUpdate:modelValue': (v: T) => (value.value = v),
});

const Page = {
	setup() {
		return () =>
			h('div', { class: 'space-y-4 p-4' }, [
				h(VInput as Component, { ...model(state.name), 'aria-label': 'Name', prefix: '@', suffix: '.dev' }),
				h(VInput as Component, {
					...model(state.amount),
					'aria-label': 'Amount',
					type: 'number',
					min: 0,
					max: 10,
					small: true,
				}),
				h(VInput as Component, { modelValue: 'locked', 'aria-label': 'Locked', disabled: true }),
				h(VTextarea as Component, { ...model(state.notes), 'aria-label': 'Notes', placeholder: 'Notes' }),
				h(VCheckbox, { ...model(state.agree), label: 'Agree' }),
				h(VCheckbox, { ...model(state.tags), value: 'y', label: 'Tag y', block: true }),
				h(VCheckbox, {
					...model(state.tags),
					value: state.other.value,
					'onUpdate:value': (v: string) => (state.other.value = v),
					customValue: true,
				}),
				h(VCheckbox, { modelValue: true, label: 'Off', disabled: true, iconOn: 'toggle_on', iconOff: 'toggle_off' }),
				h('div', { role: 'radiogroup', 'aria-label': 'Size', class: 'flex gap-4' }, [
					h(VRadio, { ...model(state.size), value: 's', label: 'Small' }),
					h(VRadio, { ...model(state.size), value: 'm', label: 'Medium' }),
					h(VRadio, { ...model(state.size), value: 'l', label: 'Large', disabled: true }),
				]),
				h(VSlider, { ...model(state.level), 'aria-label': 'Level', max: 10, showThumbLabel: true, showTicks: true }),
				h(VCheckboxTree, {
					...model(state.tree),
					choices: [
						{ text: 'Fruit', value: 'fruit', children: [{ text: 'Apple', value: 'apple' }] },
						{ text: 'Nuts', value: 'nuts' },
					],
					openGroups: ['fruit'],
				}),
				h('div', { class: 'flex gap-2' }, [
					h(VRemove, { deselect: true, onAction: () => state.removed.value++ }),
					h(VRemove, { button: true, onAction: () => state.removed.value++ }),
				]),
			]);
	},
};

test('keyboard and axe (light and dark) on the input shims', async () => {
	const wrapper = mount(Page, { attachTo: document.body, global: { plugins: [i18n] } });
	const get = (selector: string) => wrapper.get(selector).element as HTMLElement;

	await userEvent.tab();
	expect(document.activeElement).toBe(get('input[aria-label="Name"]'));
	await userEvent.keyboard('{End}b');
	expect(state.name.value).toBe('ab');

	await userEvent.tab();
	expect(document.activeElement).toBe(get('input[aria-label="Amount"]'));
	await userEvent.keyboard('{ArrowUp}');
	expect(state.amount.value).toBe(3);

	// The disabled input is skipped.
	await userEvent.tab();
	expect(document.activeElement).toBe(get('textarea'));
	await userEvent.keyboard('hi');
	expect(state.notes.value).toBe('hi');

	await userEvent.tab();
	await userEvent.keyboard(' ');
	expect(state.agree.value).toBe(true);

	await userEvent.tab();
	await userEvent.keyboard(' ');
	expect(state.tags.value).toEqual(['x', 'y']);

	// The custom value checkbox, then its text input.
	await userEvent.tab();
	expect(document.activeElement?.getAttribute('aria-label')).toBe('custom');
	await userEvent.keyboard(' ');
	expect(state.tags.value).toEqual(['x', 'y', 'custom']);
	await userEvent.tab();
	expect(document.activeElement?.tagName).toBe('INPUT');

	// The disabled checkbox is skipped; radios are buttons.
	await userEvent.tab();
	await userEvent.tab();
	expect(document.activeElement?.textContent).toContain('Medium');
	await userEvent.keyboard('{Enter}');
	expect(state.size.value).toBe('m');

	await userEvent.tab();
	expect(document.activeElement?.getAttribute('role')).toBe('slider');
	await userEvent.keyboard('{ArrowRight}');
	expect(state.level.value).toBe(6);

	const noTransitions = document.head.appendChild(document.createElement('style'));
	noTransitions.textContent = '*, *::before, *::after { transition: none !important; }';
	try {
		expect(await serious(wrapper.element)).toEqual([]);
		document.documentElement.classList.add('dark');
		expect(await serious(wrapper.element)).toEqual([]);
	} finally {
		document.documentElement.classList.remove('dark');
		noTransitions.remove();
	}
});
